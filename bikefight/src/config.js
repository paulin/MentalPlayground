"use strict";

const CONFIG = {
  arena: { width: 800, height: 600 },
  dt: 1 / 30,
  episodeSeconds: 30,
  vehicle: {
    radius: 18,
    maxSpeed: 220,
    accel: 320,
    brakeDecel: 420,
    drag: 60,
    turnRate: 2.6,
    turnFullSpeedFrac: 0.35, // reach full turn rate at this fraction of maxSpeed
    slideSpeedRetain: 0.92, // speed kept per tick while sliding along wall/obstacle
    reverseSpeedFactor: 1 / 3, // max reverse speed as a fraction of maxSpeed
    maxHealth: 4,
  },
  obstacle: {
    radius: 28,
  },
  gun: {
    reloadTime: 0.6,
    projectileSpeed: 420,
    projectileRadius: 4,
    projectileTtl: 1.6,
    coneAngle: 0.22, // radians, half-angle of the firing cone
    coneRange: 420,
  },
  rewards: {
    hitEnemy: 30,
    enemyEliminated: 120,
    hitByEnemy: -15, // less fear of trading shots, so it's willing to engage
    eliminated: -50, // losing a fight hurts less than fleeing forever
    wallCollision: -5,
    wastedShot: -1,
    enemyInCone: 0.5, // reward aiming at the enemy — pulls it toward a fight
    aliveTick: 0.0, // don't pay it just for surviving (this caused the fleeing)
    timeTick: -0.03, // stalling now costs, so it must end the match decisively
  },
  dqn: {
    bufferSize: 10000,
    batchSize: 32,
    gamma: 0.95,
    learningRate: 0.001,
    epsilonStart: 1.0,
    epsilonMin: 0.05,
    epsilonDecay: 0.99995, // multiplicative, per environment step
    targetUpdateEvery: 500, // in gradient steps
    trainEvery: 4, // environment steps between gradient steps
    minBufferToTrain: 500,
    hidden: [64, 64],
  },
  // Episodes a rolling window must cover before "best brain" snapshots start
  bestWindow: 25,
};

// Discrete action space: throttle (1 forward, 0 coast, -1 brake), steer (-1 left, 1 right), fire
const ACTIONS = [
  { name: "forward",            throttle: 1,  steer: 0,  fire: false },
  { name: "forward_left",       throttle: 1,  steer: -1, fire: false },
  { name: "forward_right",      throttle: 1,  steer: 1,  fire: false },
  { name: "coast",              throttle: 0,  steer: 0,  fire: false },
  { name: "brake",              throttle: -1, steer: 0,  fire: false },
  { name: "left",               throttle: 0,  steer: -1, fire: false },
  { name: "right",              throttle: 0,  steer: 1,  fire: false },
  { name: "fire",               throttle: 0,  steer: 0,  fire: true },
  { name: "forward_fire",       throttle: 1,  steer: 0,  fire: true },
  { name: "forward_left_fire",  throttle: 1,  steer: -1, fire: true },
  { name: "forward_right_fire", throttle: 1,  steer: 1,  fire: true },
];

const OBS_SIZE = 15;

function wrapAngle(a) {
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
}

if (typeof module !== "undefined") {
  module.exports = { CONFIG, ACTIONS, OBS_SIZE, wrapAngle };
}
