/* =============================================================================
   MJVS Playtester — training worker
   Runs the (CPU-heavy) strategy training off the main thread so the UI stays
   responsive. Drives one or more archetypes sequentially, streaming progress
   back via postMessage. The main thread stops a run by terminating the worker.
   ========================================================================== */
/* global importScripts */
importScripts("../engine.js", "strategies.js");

const E = self.MJVSEngine;
const S = self.MJVSStrategies;

// Replay a trained policy from the showcase seed, capturing the full state before
// each move. Exact for reproducible policies (evolutionary/random); skipped for
// Monte Carlo (its greedy choice isn't cheaply replayable). Powers the inspector.
function captureReplay(result, archetypeKey, seed) {
  let policy;
  if (result.policyKind === "genome") policy = S.makePolicy(result.genome);
  else if (result.policyKind === "random") policy = S.randomPolicy;
  else return null;

  const states = [];
  let s = E.makeInitialState(archetypeKey);
  const rng = E.makeRng(seed);
  let steps = 0;
  while (!s.done && steps < 300) {
    const moves = E.legalMoves(s);
    if (!moves.length) { E.endGame(s, s.cash < 10000 ? "broke" : "timeout"); break; }
    const move = policy(s, moves, rng);
    states.push({ state: E.cloneState(s), move, moves });
    s = E.step(s, move, rng).state;
    steps++;
  }
  return states;
}

self.onmessage = function (e) {
  const msg = e.data;
  if (!msg || msg.type !== "run") return;

  const strat = S.STRATEGIES[msg.strategy];
  if (!strat || !strat.implemented) {
    self.postMessage({ type: "error", message: (msg.strategy || "strategy") + " is not implemented yet." });
    return;
  }

  const reward = (S.REWARDS[msg.reward] || S.REWARDS.tier).fn;
  const seeds = S.defaultSeeds(msg.seedCount || 20);
  const results = {};

  for (const arch of msg.archetypes) {
    self.postMessage({ type: "archetypeStart", archetypeKey: arch });
    const ctx = {
      engine: E, archetypeKey: arch, reward, seeds,
      params: msg.params || {}, shouldStop: function () { return false; },
    };
    const onProgress = function (p) {
      self.postMessage(Object.assign({ type: "progress", archetypeKey: arch }, p));
    };

    let result;
    try {
      result = strat.train(ctx, onProgress);
    } catch (err) {
      self.postMessage({ type: "error", message: String(err && err.message || err), archetypeKey: arch });
      return;
    }
    result.seed = seeds[0];
    result.rewardName = msg.reward;
    result.replay = captureReplay(result, arch, seeds[0]);
    results[arch] = result;
    self.postMessage({ type: "archetypeDone", archetypeKey: arch, result: result });
  }

  self.postMessage({ type: "done", results: results });
};
