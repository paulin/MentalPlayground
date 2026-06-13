"use strict";

// Scripted opponent: turn toward the learner, close distance when far,
// fire when the learner is in the firing cone, avoid walls and obstacles.
function scriptedBotControls(sim, idx) {
  const self = sim.vehicles[idx];
  const enemy = sim.vehicles[1 - idx];
  if (!self.alive) return { throttle: 0, steer: 0, fire: false };

  const dx = enemy.x - self.x;
  const dy = enemy.y - self.y;
  const dist = Math.hypot(dx, dy);
  const diff = wrapAngle(Math.atan2(dy, dx) - self.heading);

  let steer = Math.abs(diff) > 0.06 ? Math.sign(diff) : 0;
  let throttle;
  if (dist > 180) throttle = 1;
  else if (dist > 90) throttle = 0;
  else throttle = -1;

  // Wall & obstacle avoidance: if something blocks the path ahead, steer
  // toward the more open side. Slow down only for very close blockers so the
  // bot still threads past obstacles instead of freezing.
  const front = sim.clearance(self, 0);
  if (front < 110 && self.speed > 40) {
    const left = sim.clearance(self, -Math.PI / 2);
    const right = sim.clearance(self, Math.PI / 2);
    steer = left > right ? -1 : 1;
    if (front < 70) throttle = -1;
  }

  const fire = enemy.alive && sim.inFiringCone(self, enemy) && self.reloadTimer <= 0;
  return { throttle, steer, fire };
}

if (typeof module !== "undefined") {
  module.exports = { scriptedBotControls };
}
