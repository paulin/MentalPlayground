"use strict";

class Vehicle {
  constructor(cfg) {
    this.cfg = cfg;
    this.reset(0, 0, 0);
  }

  reset(x, y, heading) {
    this.x = x;
    this.y = y;
    this.heading = heading;
    this.speed = 0;
    this.health = this.cfg.vehicle.maxHealth;
    this.reloadTimer = 0;
    this.alive = true;
    this.touchingWall = false;
  }
}

class Projectile {
  constructor(x, y, angle, speed, owner, ttl) {
    this.x = x;
    this.y = y;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.owner = owner;
    this.ttl = ttl;
    this.alive = true;
  }
}

function emptyEvents() {
  return {
    hitsDealt: 0,
    hitsTaken: 0,
    wallHit: false,
    wastedShots: 0,
    fired: false,
    eliminatedEnemy: false,
    eliminated: false,
    enemyInCone: false,
  };
}

class Simulation {
  constructor(cfg) {
    this.cfg = cfg;
    this.vehicles = [new Vehicle(cfg), new Vehicle(cfg)];
    this.projectiles = [];
    this.obstacles = []; // green circles: block shots and movement, persist across resets
    this.maxTicks = Math.round(cfg.episodeSeconds / cfg.dt);
    this.reset();
  }

  addObstacle(x, y) {
    this.obstacles.push({ x, y, radius: this.cfg.obstacle.radius });
  }

  clearObstacles() {
    this.obstacles = [];
  }

  reset() {
    const { width: W, height: H } = this.cfg.arena;
    const jitter = () => (Math.random() - 0.5) * 0.3;
    const y0 = H * (0.35 + Math.random() * 0.3);
    const y1 = H * (0.35 + Math.random() * 0.3);
    this.vehicles[0].reset(W * 0.2, y0, jitter());
    this.vehicles[1].reset(W * 0.8, y1, Math.PI + jitter());
    this.projectiles = [];
    this.tick = 0;
    this.needsReset = false;
  }

  step(controls0, controls1) {
    const events = [emptyEvents(), emptyEvents()];
    const controls = [controls0, controls1];
    this.tick++;

    for (let i = 0; i < 2; i++) {
      const v = this.vehicles[i];
      if (!v.alive) continue;
      this.stepVehicle(v, controls[i], events[i], i);
    }

    this.separateVehicles();
    this.updateProjectiles(events);

    events[0].enemyInCone = this.inFiringCone(this.vehicles[0], this.vehicles[1]);
    events[1].enemyInCone = this.inFiringCone(this.vehicles[1], this.vehicles[0]);

    const done =
      !this.vehicles[0].alive ||
      !this.vehicles[1].alive ||
      this.tick >= this.maxTicks;
    let winner = null;
    if (done) {
      this.needsReset = true;
      if (this.vehicles[0].alive && !this.vehicles[1].alive) winner = 0;
      else if (this.vehicles[1].alive && !this.vehicles[0].alive) winner = 1;
    }
    return { events, done, winner };
  }

  stepVehicle(v, c, ev, ownerIdx) {
    const { dt } = this.cfg;
    const vc = this.cfg.vehicle;
    const gun = this.cfg.gun;

    // A bike can only steer while it's rolling, but it reaches full turn
    // agility well below top speed so it can swerve around obstacles instead of
    // grinding into them. (Magnitude, so it can still steer in reverse.)
    const steerFactor = Math.min(1, Math.abs(v.speed) / (vc.maxSpeed * vc.turnFullSpeedFrac));
    v.heading = wrapAngle(v.heading + c.steer * vc.turnRate * steerFactor * dt);

    if (c.throttle > 0) {
      v.speed += vc.accel * dt;
    } else if (c.throttle < 0) {
      // Brake, then reverse — lets a stuck bike back out
      v.speed -= vc.brakeDecel * dt;
    } else {
      // Coast: drag always bleeds speed toward zero, whichever way we're moving
      if (v.speed > 0) v.speed = Math.max(0, v.speed - vc.drag * dt);
      else if (v.speed < 0) v.speed = Math.min(0, v.speed + vc.drag * dt);
    }
    const maxReverse = vc.maxSpeed * vc.reverseSpeedFactor;
    v.speed = Math.max(-maxReverse, Math.min(vc.maxSpeed, v.speed));

    v.x += Math.cos(v.heading) * v.speed * dt;
    v.y += Math.sin(v.heading) * v.speed * dt;

    // Wall collision: clamp inside the arena and build an inward normal so the
    // bike slides along the wall instead of grinding to a halt against it.
    const r = vc.radius;
    const { width: W, height: H } = this.cfg.arena;
    let hitWall = false;
    let wnx = 0, wny = 0;
    if (v.x < r) { v.x = r; wnx += 1; hitWall = true; }
    if (v.x > W - r) { v.x = W - r; wnx -= 1; hitWall = true; }
    if (v.y < r) { v.y = r; wny += 1; hitWall = true; }
    if (v.y > H - r) { v.y = H - r; wny -= 1; hitWall = true; }
    if (hitWall) {
      const nl = Math.hypot(wnx, wny);
      if (nl > 1e-9) this.slideHeading(v, wnx / nl, wny / nl);
    }

    // Obstacle collision: push the bike out, then redirect its heading along
    // the obstacle's tangent so it slides around the curve instead of getting
    // hung up grinding straight into it.
    let hitObstacle = false;
    for (const o of this.obstacles) {
      const ox = v.x - o.x;
      const oy = v.y - o.y;
      const od = Math.hypot(ox, oy);
      const minD = r + o.radius;
      if (od >= minD) continue;
      hitObstacle = true;
      // Outward normal from the obstacle center to the bike
      let nx, ny;
      if (od > 1e-9) { nx = ox / od; ny = oy / od; }
      else { nx = Math.cos(v.heading + Math.PI); ny = Math.sin(v.heading + Math.PI); }
      v.x = o.x + nx * minD;
      v.y = o.y + ny * minD;
      this.slideHeading(v, nx, ny);
    }
    // Re-clamp to the arena in case an obstacle push shoved us past a wall
    v.x = Math.max(r, Math.min(W - r, v.x));
    v.y = Math.max(r, Math.min(H - r, v.y));

    // Both walls and obstacles barely slow you now — you slide along them.
    if (hitWall || hitObstacle) v.speed *= vc.slideSpeedRetain;
    const collided = hitWall || hitObstacle;
    if (collided && !v.touchingWall) ev.wallHit = true;
    v.touchingWall = collided;

    // Weapon
    v.reloadTimer = Math.max(0, v.reloadTimer - dt);
    if (c.fire && v.reloadTimer <= 0) {
      const noseX = v.x + Math.cos(v.heading) * (r + gun.projectileRadius + 2);
      const noseY = v.y + Math.sin(v.heading) * (r + gun.projectileRadius + 2);
      this.projectiles.push(
        new Projectile(noseX, noseY, v.heading, gun.projectileSpeed, ownerIdx, gun.projectileTtl)
      );
      v.reloadTimer = gun.reloadTime;
      ev.fired = true;
    }
  }

  // If the bike is driving into a surface (inward unit normal nx,ny), redirect
  // its heading along the tangent so it slides along the surface.
  slideHeading(v, nx, ny) {
    const fx = Math.cos(v.heading);
    const fy = Math.sin(v.heading);
    const into = fx * nx + fy * ny; // < 0 means heading points into the surface
    if (into >= 0) return;
    const tx = fx - into * nx;
    const ty = fy - into * ny;
    const tl = Math.hypot(tx, ty);
    if (tl > 1e-6) v.heading = Math.atan2(ty / tl, tx / tl);
  }

  separateVehicles() {
    const [a, b] = this.vehicles;
    if (!a.alive || !b.alive) return;
    const r = this.cfg.vehicle.radius;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dist = Math.hypot(dx, dy);
    const minDist = r * 2;
    if (dist >= minDist || dist === 0) return;
    const push = (minDist - dist) / 2;
    const nx = dx / dist;
    const ny = dy / dist;
    a.x -= nx * push;
    a.y -= ny * push;
    b.x += nx * push;
    b.y += ny * push;
    a.speed *= 0.8;
    b.speed *= 0.8;
    const { width: W, height: H } = this.cfg.arena;
    for (const v of this.vehicles) {
      v.x = Math.max(r, Math.min(W - r, v.x));
      v.y = Math.max(r, Math.min(H - r, v.y));
    }
  }

  updateProjectiles(events) {
    const { dt } = this.cfg;
    const { width: W, height: H } = this.cfg.arena;
    const hitRadius = this.cfg.vehicle.radius + this.cfg.gun.projectileRadius;

    for (const p of this.projectiles) {
      if (!p.alive) continue;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.ttl -= dt;

      // Obstacles block shots
      let blocked = false;
      for (const o of this.obstacles) {
        if (Math.hypot(o.x - p.x, o.y - p.y) < o.radius + this.cfg.gun.projectileRadius) {
          blocked = true;
          break;
        }
      }
      if (blocked) {
        p.alive = false;
        events[p.owner].wastedShots++;
        continue;
      }

      const target = this.vehicles[1 - p.owner];
      if (target.alive && Math.hypot(target.x - p.x, target.y - p.y) < hitRadius) {
        p.alive = false;
        target.health--;
        events[p.owner].hitsDealt++;
        events[1 - p.owner].hitsTaken++;
        if (target.health <= 0) {
          target.alive = false;
          events[p.owner].eliminatedEnemy = true;
          events[1 - p.owner].eliminated = true;
        }
        continue;
      }

      if (p.x < 0 || p.x > W || p.y < 0 || p.y > H || p.ttl <= 0) {
        p.alive = false;
        events[p.owner].wastedShots++;
      }
    }
    this.projectiles = this.projectiles.filter((p) => p.alive);
  }

  inFiringCone(shooter, target) {
    if (!shooter.alive || !target.alive) return false;
    const dx = target.x - shooter.x;
    const dy = target.y - shooter.y;
    const dist = Math.hypot(dx, dy);
    if (dist > this.cfg.gun.coneRange) return false;
    const relAngle = wrapAngle(Math.atan2(dy, dx) - shooter.heading);
    return Math.abs(relAngle) < this.cfg.gun.coneAngle;
  }

  // Distance from a vehicle to the arena wall along heading + relAngle
  wallDistance(v, relAngle) {
    const angle = v.heading + relAngle;
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    const { width: W, height: H } = this.cfg.arena;
    let t = Infinity;
    if (dx > 1e-9) t = Math.min(t, (W - v.x) / dx);
    else if (dx < -1e-9) t = Math.min(t, -v.x / dx);
    if (dy > 1e-9) t = Math.min(t, (H - v.y) / dy);
    else if (dy < -1e-9) t = Math.min(t, -v.y / dy);
    return t === Infinity ? Math.hypot(W, H) : Math.max(0, t);
  }

  // Distance to the nearest obstacle along heading + relAngle (Infinity if none)
  obstacleDistance(v, relAngle) {
    const angle = v.heading + relAngle;
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    let t = Infinity;
    for (const o of this.obstacles) {
      const hit = rayCircleHit(v.x, v.y, dx, dy, o.x, o.y, o.radius);
      if (hit < t) t = hit;
    }
    return t;
  }

  // Clearance ahead along a ray: nearest of wall or obstacle. This is what the
  // bikes sense, so they can steer around obstacles instead of into them.
  clearance(v, relAngle) {
    return Math.min(this.wallDistance(v, relAngle), this.obstacleDistance(v, relAngle));
  }

  getObservation(i) {
    const v = this.vehicles[i];
    const e = this.vehicles[1 - i];
    const { width: W, height: H } = this.cfg.arena;
    const diag = Math.hypot(W, H);
    const dx = e.x - v.x;
    const dy = e.y - v.y;
    const dist = Math.hypot(dx, dy);
    const relAngle = wrapAngle(Math.atan2(dy, dx) - v.heading);
    return [
      v.x / W,
      v.y / H,
      Math.sin(v.heading),
      Math.cos(v.heading),
      v.speed / this.cfg.vehicle.maxSpeed,
      dx / W,
      dy / H,
      dist / diag,
      Math.sin(relAngle),
      Math.cos(relAngle),
      this.inFiringCone(v, e) ? 1 : 0,
      v.reloadTimer <= 0 ? 1 : 0,
      this.clearance(v, 0) / diag,
      this.clearance(v, -Math.PI / 2) / diag,
      this.clearance(v, Math.PI / 2) / diag,
    ];
  }

  computeReward(i, stepResult) {
    const e = stepResult.events[i];
    const R = this.cfg.rewards;
    const v = this.vehicles[i];
    let r = R.timeTick;
    if (v.alive) r += R.aliveTick;
    if (e.enemyInCone) r += R.enemyInCone;
    r += e.hitsDealt * R.hitEnemy;
    r += e.hitsTaken * R.hitByEnemy;
    r += e.wastedShots * R.wastedShot;
    if (e.wallHit) r += R.wallCollision;
    if (e.eliminatedEnemy) r += R.enemyEliminated;
    if (e.eliminated) r += R.eliminated;
    return r;
  }
}

// Smallest non-negative distance from point (px,py) along unit ray (dx,dy) to
// the circle centered (cx,cy) radius R. Infinity if the ray misses.
function rayCircleHit(px, py, dx, dy, cx, cy, R) {
  const fx = px - cx;
  const fy = py - cy;
  const b = 2 * (fx * dx + fy * dy);
  const c = fx * fx + fy * fy - R * R;
  const disc = b * b - 4 * c; // ray dir is unit, so a = 1
  if (disc < 0) return Infinity;
  const s = Math.sqrt(disc);
  const t1 = (-b - s) / 2;
  if (t1 >= 0) return t1;
  const t2 = (-b + s) / 2;
  if (t2 >= 0) return t2; // ray origin is inside the circle
  return Infinity;
}

if (typeof module !== "undefined") {
  module.exports = { Simulation, Vehicle, Projectile };
}
