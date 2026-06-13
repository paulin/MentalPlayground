"use strict";

// Headless smoke test: scripted bot vs scripted bot, plus observation and
// reward sanity checks. Run with: node test/smoke.js

const { CONFIG, ACTIONS, OBS_SIZE, wrapAngle } = require("../src/config.js");
global.wrapAngle = wrapAngle;
const { Simulation } = require("../src/sim.js");
const { scriptedBotControls } = require("../src/scriptedBot.js");

function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exit(1);
  }
}

const sim = new Simulation(CONFIG);
let episodes = 0;
let wins = [0, 0];
let eliminations = 0;
let totalTicks = 0;
let totalReward0 = 0;

while (episodes < 20) {
  if (sim.needsReset) sim.reset();

  const c0 = scriptedBotControls(sim, 0);
  const c1 = scriptedBotControls(sim, 1);
  const result = sim.step(c0, c1);
  totalTicks++;

  const obs = sim.getObservation(0);
  assert(obs.length === OBS_SIZE, `observation length ${obs.length} != ${OBS_SIZE}`);
  assert(obs.every(Number.isFinite), "observation contains non-finite value: " + obs);

  const r = sim.computeReward(0, result);
  assert(Number.isFinite(r), "reward not finite");
  totalReward0 += r;

  for (const v of sim.vehicles) {
    assert(Number.isFinite(v.x) && Number.isFinite(v.y), "vehicle position not finite");
    assert(v.x >= 0 && v.x <= CONFIG.arena.width, "vehicle x out of bounds");
    assert(v.y >= 0 && v.y <= CONFIG.arena.height, "vehicle y out of bounds");
  }

  if (result.done) {
    episodes++;
    if (result.winner !== null) wins[result.winner]++;
    eliminations += sim.vehicles.filter((v) => !v.alive).length;
    assert(sim.tick <= sim.maxTicks, "episode exceeded max ticks");
  }
}

assert(ACTIONS.length === 11, "expected 11 actions");
assert(eliminations > 0, "no eliminations in 20 bot-vs-bot episodes — combat may be broken");

console.log(`PASS: ${episodes} episodes, ${totalTicks} ticks`);
console.log(`  wins: blue ${wins[0]}, red ${wins[1]}, draws ${episodes - wins[0] - wins[1]}`);
console.log(`  avg episode length: ${(totalTicks / episodes).toFixed(0)} ticks`);
console.log(`  avg reward (vehicle 0): ${(totalReward0 / episodes).toFixed(1)} per episode`);
