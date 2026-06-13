"use strict";

const VEHICLE_COLORS = ["#4ea3f0", "#f05a5a"];

class Renderer {
  constructor(canvas, cfg) {
    this.ctx = canvas.getContext("2d");
    this.cfg = cfg;
    this.width = canvas.width;
    this.height = canvas.height;
  }

  draw(sim) {
    const ctx = this.ctx;
    ctx.fillStyle = "#1b1e27";
    ctx.fillRect(0, 0, this.width, this.height);

    // Arena border
    ctx.strokeStyle = "#3a4052";
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, this.width - 2, this.height - 2);

    // Obstacles (green circles) — block shots and bikes
    for (const o of sim.obstacles) {
      ctx.fillStyle = "#3fb950";
      ctx.beginPath();
      ctx.arc(o.x, o.y, o.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#2ea043";
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    for (let i = 0; i < 2; i++) {
      this.drawVehicle(sim.vehicles[i], VEHICLE_COLORS[i], sim);
    }

    ctx.fillStyle = "#ffb347";
    for (const p of sim.projectiles) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, this.cfg.gun.projectileRadius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawVehicle(v, color, sim) {
    const ctx = this.ctx;
    const r = this.cfg.vehicle.radius;

    if (!v.alive) {
      ctx.strokeStyle = "#555c6e";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(v.x - r * 0.7, v.y - r * 0.7);
      ctx.lineTo(v.x + r * 0.7, v.y + r * 0.7);
      ctx.moveTo(v.x + r * 0.7, v.y - r * 0.7);
      ctx.lineTo(v.x - r * 0.7, v.y + r * 0.7);
      ctx.stroke();
      return;
    }

    // Firing cone (faint)
    const gun = this.cfg.gun;
    ctx.fillStyle = "rgba(255, 255, 255, 0.04)";
    ctx.beginPath();
    ctx.moveTo(v.x, v.y);
    ctx.arc(v.x, v.y, gun.coneRange, v.heading - gun.coneAngle, v.heading + gun.coneAngle);
    ctx.closePath();
    ctx.fill();

    // Body
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(v.x, v.y, r, 0, Math.PI * 2);
    ctx.fill();

    // Gun barrel
    ctx.strokeStyle = "#f0f2f7";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(v.x, v.y);
    ctx.lineTo(v.x + Math.cos(v.heading) * (r + 8), v.y + Math.sin(v.heading) * (r + 8));
    ctx.stroke();

    // Health bar
    const maxHealth = this.cfg.vehicle.maxHealth;
    const barW = r * 2;
    const barY = v.y - r - 9;
    ctx.fillStyle = "#2a2f3d";
    ctx.fillRect(v.x - r, barY, barW, 4);
    ctx.fillStyle = "#8fd18f";
    ctx.fillRect(v.x - r, barY, barW * (v.health / maxHealth), 4);
  }
}
