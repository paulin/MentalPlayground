/* =============================================================================
   MJVS Playtester — Strategies + Rewards
   Pluggable learning strategies and reward functions that drive the engine
   headlessly to discover strong play. Depends only on MJVSEngine.

   Adding a new learning method later (Q-learning, DQN, MCTS) = implementing the
   Strategy contract below and registering it in STRATEGIES. No engine or UI
   changes required.

     Strategy = {
       name, label, describe, implemented,
       // Train for ONE archetype. Call onProgress(p) periodically. Return a
       // result object (see TrainResult). Honor ctx.shouldStop().
       train(ctx, onProgress) -> TrainResult
     }
     ctx = { engine, archetypeKey, reward, seeds, params, shouldStop }
     Reward = (outcome, finalState) -> number   (higher is better)

   Loads in browser (<script>), worker (importScripts), and JavaScriptCore.
   ========================================================================== */
(function (root, factory) {
  "use strict";
  const api = factory(
    (typeof module === "object" && module.exports)
      ? require("../engine.js")
      : (typeof root !== "undefined" ? root.MJVSEngine : undefined)
  );
  /* eslint-disable no-undef */
  if (typeof module === "object" && module.exports) module.exports = api;
  if (typeof root !== "undefined") root.MJVSStrategies = api;
  /* eslint-enable no-undef */
})(typeof globalThis !== "undefined" ? globalThis : this, function (E) {
  "use strict";

  if (!E) throw new Error("MJVSStrategies requires MJVSEngine to be loaded first.");

  /* --- Rewards (swappable in the UI) -------------------------------------- */

  // Default: the 6-tier endgame ranking dominates, with revenue / contribution /
  // reputation as tie-breakers. Tier weight (1e7) is far above any tie-breaker,
  // so a higher tier always wins; within a tier, more MRR/score/rep wins.
  function tierReward(outcome, s) {
    const rank = E.OUTCOME_RANK[outcome.key] || 0;
    return rank * 1e7 + s.mrr + outcome.score * 1000 + s.reputation * 100;
  }

  // Pure revenue: maximize annual recurring revenue.
  function arrReward(outcome, s) {
    return s.mrr * 12;
  }

  // Tunable blend — lets you steer what "good play" means and probe balance.
  // weights default to a balanced mix; speed rewards finishing in fewer weeks.
  function makeWeightedReward(weights) {
    const w = Object.assign({ mrr: 1, score: 1000, reputation: 100, spinoutBonus: 2e6, speed: 200 }, weights || {});
    return function (outcome, s) {
      const spun = s.spunOut ? w.spinoutBonus : 0;
      return spun + w.mrr * s.mrr + w.score * outcome.score + w.reputation * s.reputation - w.speed * s.week;
    };
  }

  const REWARDS = {
    tier: { label: "Best outcome tier", fn: tierReward,
      describe: "Tier ranking (failed→champion) dominates; MRR, contribution, and reputation break ties." },
    arr: { label: "Maximize ARR", fn: arrReward,
      describe: "Pure annual recurring revenue (MRR × 12)." },
    weighted: { label: "Weighted blend", fn: makeWeightedReward(),
      describe: "Tunable mix of MRR + contribution + reputation + spinout + speed." },
  };

  /* --- Shared helpers ----------------------------------------------------- */

  // A fixed, well-spread set of seeds so every candidate is judged on the same
  // sample of the game's randomness (fair comparison under the 28% event chance).
  function defaultSeeds(n) {
    const seeds = [];
    for (let i = 0; i < n; i++) seeds.push(((i + 1) * 0x9e3779b1) >>> 0);
    return seeds;
  }

  function gauss(rng) {
    let u = 0, v = 0;
    while (u === 0) u = rng();
    while (v === 0) v = rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  // --- Policy representation (the "genome") -------------------------------
  // A policy is a preference over moves: one weight per action, a per-phase weight
  // for the "advance" move, and a `repeatDecay` trait. At each state it picks the
  // highest-scoring legal move, where an action's score is its weight MINUS
  // repeatDecay × (times already taken this episode). The decay is what stops the
  // degenerate trap of repeating one non-progressing action forever — it forces
  // the policy to rotate onward (e.g. eventually take the once-only `build`).
  // The result stays interpretable: you can read off "in Scale it prefers
  // gtm_engine, repeats it a few times, then advances".

  function randomGenome(rng) {
    const actionWeights = {};
    for (const a of E.ACTIONS) actionWeights[a.id] = rng();
    const advanceWeight = {};
    for (const p of E.PHASES) advanceWeight[p.key] = rng();
    return { actionWeights, advanceWeight, repeatDecay: 0.15 + rng() * 0.5 };
  }

  function mutateGenome(g, rng, sigma) {
    const actionWeights = {};
    for (const k in g.actionWeights) actionWeights[k] = g.actionWeights[k] + gauss(rng) * sigma;
    const advanceWeight = {};
    for (const k in g.advanceWeight) advanceWeight[k] = g.advanceWeight[k] + gauss(rng) * sigma;
    let repeatDecay = g.repeatDecay + gauss(rng) * sigma * 0.5;
    if (repeatDecay < 0) repeatDecay = 0;
    return { actionWeights, advanceWeight, repeatDecay };
  }

  // Turn a genome into a FRESH stateful policyFn(state, moves, rng) -> moveId.
  // Must be called once per episode (it carries per-episode repeat counts).
  function makePolicy(genome) {
    const counts = {};
    return function (state, moves, rng) {
      let best = moves[0], bestScore = -Infinity;
      for (const m of moves) {
        let w;
        if (m === "advance") w = genome.advanceWeight[E.PHASES[state.phaseIndex].key];
        else w = genome.actionWeights[m] - (counts[m] || 0) * genome.repeatDecay;
        const score = w + (rng() - 0.5) * 1e-9; // deterministic tie-break via rng
        if (score > bestScore) { bestScore = score; best = m; }
      }
      if (best !== "advance") counts[best] = (counts[best] || 0) + 1;
      return best;
    };
  }

  const randomPolicy = function (state, moves, rng) {
    return moves[Math.floor(rng() * moves.length)];
  };

  // Evaluate across the fixed seed set: mean reward + outcome distribution + a
  // sample episode (seeds[0]) for the playbook view. `policyFactory()` returns a
  // FRESH policy per episode (stateful policies must not leak counts across runs).
  function evalPolicy(policyFactory, archetypeKey, seeds, reward) {
    let sum = 0;
    const dist = {};
    let sample = null;
    for (let i = 0; i < seeds.length; i++) {
      const r = E.playEpisode(archetypeKey, policyFactory(), E.makeRng(seeds[i]));
      sum += reward(r.outcome, r.finalState);
      dist[r.outcome.key] = (dist[r.outcome.key] || 0) + 1;
      if (i === 0) sample = r;
    }
    return { fitness: sum / seeds.length, dist, sample };
  }

  // Human-readable playbook from a sample episode: ordered steps + final summary.
  function annotateTrace(r) {
    const steps = r.moveTrace.map((t) => {
      if (t.move === "advance") {
        const nextPhase = E.PHASES[t.phaseIndex + 1];
        return { move: "advance", label: "▶ Advance to " + (nextPhase ? nextPhase.name : "next"), phase: E.PHASES[t.phaseIndex].name };
      }
      const a = E.actionById(t.move);
      return { move: t.move, label: a ? a.title : t.move, phase: E.PHASES[t.phaseIndex].name };
    });
    const s = r.finalState;
    return {
      steps,
      outcome: r.outcome,
      summary: {
        outcomeKey: r.outcome.key,
        mrr: s.mrr, arr: r.outcome.annual, customers: s.customers,
        score: Math.round(r.outcome.score), reputation: Math.round(s.reputation),
        weeks: s.week, phaseReached: E.PHASES[s.phaseIndex].name, spunOut: s.spunOut,
      },
    };
  }

  // Monte Carlo move values: for each legal move at `state`, average the reward of
  // `samples` rollouts (take the move, then play `basePolicy` to the end). Powers
  // the "what is it considering" inspector.
  function mcMoveValues(state, basePolicy, reward, samples, rng) {
    const moves = E.legalMoves(state);
    return moves.map((m) => {
      let sum = 0;
      for (let i = 0; i < samples; i++) {
        let s = E.step(state, m, rng).state;
        let steps = 0;
        while (!s.done && steps < 300) {
          const mv = E.legalMoves(s);
          if (!mv.length) { E.endGame(s, s.cash < 10000 ? "broke" : "timeout"); break; }
          s = E.step(s, basePolicy(s, mv, rng), rng).state;
          steps++;
        }
        if (!s.done) E.endGame(s, s.cash < 10000 ? "broke" : "timeout");
        sum += reward(s.outcome, s);
      }
      const a = m === "advance" ? null : E.actionById(m);
      return { move: m, label: m === "advance" ? "▶ Advance" : (a ? a.title : m), value: sum / samples, samples };
    }).sort((x, y) => y.value - x.value);
  }

  /* --- Strategy: Random baseline ------------------------------------------ */

  const RandomBaseline = {
    name: "random",
    label: "Random baseline",
    implemented: true,
    describe: "Picks uniformly among legal moves. The reference floor every learner should beat.",
    train(ctx) {
      const { archetypeKey, reward, seeds } = ctx;
      const res = evalPolicy(() => randomPolicy, archetypeKey, seeds, reward);
      return {
        strategy: "random", archetypeKey,
        fitness: res.fitness, dist: res.dist,
        playbook: annotateTrace(res.sample),
        history: [{ gen: 0, best: res.fitness, mean: res.fitness }],
        policyKind: "random",
      };
    },
  };

  /* --- Strategy: Evolutionary policy search (primary) --------------------- */

  const EvolutionaryPolicy = {
    name: "evolutionary",
    label: "Evolutionary policy search",
    implemented: true,
    describe: "Evolves a population of move-preference policies; fitness = mean reward over a fixed seed set. Outputs an interpretable per-phase playbook.",
    train(ctx, onProgress) {
      const { archetypeKey, reward, seeds, params, shouldStop } = ctx;
      const P = Object.assign(
        { population: 40, generations: 60, mutationSigma: 0.15, eliteFrac: 0.25, masterSeed: 12345 },
        params || {}
      );
      const rng = E.makeRng(P.masterSeed);
      const eliteCount = Math.max(2, Math.round(P.population * P.eliteFrac));

      // Seed the population.
      let pop = [];
      for (let i = 0; i < P.population; i++) pop.push(randomGenome(rng));

      const history = [];
      let best = null;

      for (let gen = 0; gen < P.generations; gen++) {
        if (shouldStop && shouldStop()) break;

        // Evaluate.
        const scored = pop.map((g) => {
          const ev = evalPolicy(() => makePolicy(g), archetypeKey, seeds, reward);
          return { genome: g, fitness: ev.fitness, dist: ev.dist, sample: ev.sample };
        });
        scored.sort((a, b) => b.fitness - a.fitness);

        const meanFit = scored.reduce((s, x) => s + x.fitness, 0) / scored.length;
        if (!best || scored[0].fitness > best.fitness) best = scored[0];

        history.push({ gen, best: best.fitness, mean: meanFit });
        if (onProgress) {
          onProgress({
            gen, generations: P.generations,
            best: best.fitness, mean: meanFit,
            dist: best.dist, bestOutcome: best.sample.outcome.key,
          });
        }

        // Reproduce: keep elites, fill the rest with mutated elites.
        const elites = scored.slice(0, eliteCount).map((x) => x.genome);
        const next = elites.slice();
        while (next.length < P.population) {
          const parent = elites[Math.floor(rng() * elites.length)];
          next.push(mutateGenome(parent, rng, P.mutationSigma));
        }
        pop = next;
      }

      return {
        strategy: "evolutionary", archetypeKey,
        fitness: best.fitness, dist: best.dist,
        playbook: annotateTrace(best.sample),
        history,
        genome: best.genome,
        policyKind: "genome",
      };
    },
  };

  /* --- Strategy: Monte Carlo rollouts ------------------------------------- */
  // A greedy policy that, at each step, picks the move with the best estimated
  // value from random rollouts. Slower (it simulates the future every move) but
  // needs no training, and powers the move inspector.

  const MonteCarloRollouts = {
    name: "montecarlo",
    label: "Monte Carlo rollouts",
    implemented: true,
    describe: "At each step, samples random rollouts per move and greedily takes the highest-value one. No training phase; powers the move inspector.",
    train(ctx, onProgress) {
      const { archetypeKey, reward, seeds, params } = ctx;
      const P = Object.assign({ mcSamples: 16, masterSeed: 777 }, params || {});
      const rng = E.makeRng(P.masterSeed);
      const greedy = function (state, moves, r) {
        if (moves.length === 1) return moves[0];
        const vals = mcMoveValues(state, randomPolicy, reward, P.mcSamples, rng);
        return vals[0].move;
      };
      // Evaluate the greedy MC policy over a (small) seed set.
      const useSeeds = seeds.slice(0, Math.min(seeds.length, 8));
      let sum = 0;
      const dist = {};
      let sample = null;
      for (let i = 0; i < useSeeds.length; i++) {
        const r = E.playEpisode(archetypeKey, greedy, E.makeRng(useSeeds[i]));
        sum += reward(r.outcome, r.finalState);
        dist[r.outcome.key] = (dist[r.outcome.key] || 0) + 1;
        if (i === 0) sample = r;
        if (onProgress) {
          onProgress({
            gen: i, generations: useSeeds.length,
            best: sum / (i + 1), mean: sum / (i + 1),
            dist, bestOutcome: r.outcome.key,
          });
        }
      }
      return {
        strategy: "montecarlo", archetypeKey,
        fitness: sum / useSeeds.length, dist,
        playbook: annotateTrace(sample),
        history: [{ gen: 0, best: sum / useSeeds.length, mean: sum / useSeeds.length }],
        policyKind: "montecarlo",
      };
    },
  };

  /* --- Stubs for future methods (interface present, not yet implemented) -- */

  function stub(name, label, describe) {
    return {
      name, label, implemented: false, describe,
      train() { throw new Error(label + " is not implemented yet. Implement the Strategy.train contract to enable it."); },
    };
  }

  const STRATEGIES = {
    evolutionary: EvolutionaryPolicy,
    montecarlo: MonteCarloRollouts,
    random: RandomBaseline,
    qlearning: stub("qlearning", "Tabular Q-learning",
      "Classic RL over a discretized state. Reserved — interface wired, learning rule TODO."),
    dqn: stub("dqn", "Deep Q-Network (TF.js)",
      "Neural-net RL in the bikefight 'Inside the Brain' style. Reserved for later."),
    mcts: stub("mcts", "Monte Carlo Tree Search",
      "UCT tree search over the move space. Reserved for later."),
  };

  /* --- Exports ------------------------------------------------------------ */

  return {
    REWARDS, STRATEGIES,
    // helpers reused by the UI / worker
    defaultSeeds, makePolicy, randomPolicy, evalPolicy, annotateTrace, mcMoveValues,
  };
});
