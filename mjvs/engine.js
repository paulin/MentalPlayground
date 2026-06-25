/* =============================================================================
   MJ Venture Studio — Headless Engine
   The pure rules + simulation model of the game, with NO DOM and NO global
   mutable game state. Everything operates on a `state` object passed in, and all
   randomness flows through an injected `rng` (a function returning [0,1)).

   This is the single source of truth for game rules. Both the interactive game
   (app.js) and the playtester (playtest/) consume it, so a strategy discovered
   by the playtester is replayable move-for-move in the real game.

   Loads three ways:
     • browser  <script src="engine.js">  → globalThis.MJVSEngine
     • worker   importScripts("engine.js") → self.MJVSEngine
     • node     require("./engine.js")      → module.exports
   ========================================================================== */
(function (root, factory) {
  "use strict";
  const api = factory();
  /* eslint-disable no-undef */
  if (typeof module === "object" && module.exports) module.exports = api;
  if (typeof root !== "undefined") root.MJVSEngine = api;
  /* eslint-enable no-undef */
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  /* --- Static config ------------------------------------------------------ */

  // Contribution categories and their studio-economic weights (from the spec).
  const CATEGORIES = [
    { key: "origination", label: "Venture Origination", weight: 0.10, color: "#6fc3ff" },
    { key: "product", label: "Product & Engineering", weight: 0.20, color: "#7ed6a0" },
    { key: "gtm", label: "GTM & Customer Acquisition", weight: 0.20, color: "#e0a06f" },
    { key: "ops", label: "Operations & Delivery", weight: 0.15, color: "#c79ae0" },
    { key: "partnerships", label: "Strategic Partnerships", weight: 0.15, color: "#e0d06f" },
    { key: "fundraising", label: "Fundraising", weight: 0.05, color: "#6fe0d6" },
    { key: "leadership", label: "Leadership & Governance", weight: 0.15, color: "#e08fb0" },
  ];

  const ARCHETYPES = [
    {
      key: "builder",
      name: "Builder",
      flavor: "You think in product. The wedge gets built fast and well, but you must remember to sell it.",
      boosts: { product: 1.6 },
      start: { cash: 230000, certainty: 12 },
      perks: ["+60% Product & Engineering output", "MVP build is faster and cheaper"],
    },
    {
      key: "operator",
      name: "Operator",
      flavor: "You make the machine run. Delivery is tight and time is never wasted.",
      boosts: { ops: 1.6 },
      start: { cash: 240000, time: 116 },
      perks: ["+60% Operations & Delivery output", "+12 weeks of runway efficiency"],
    },
    {
      key: "rainmaker",
      name: "Rainmaker",
      flavor: "You open doors and close deals. Customers and revenue come early.",
      boosts: { gtm: 1.6 },
      start: { cash: 240000, reputation: 60 },
      perks: ["+60% GTM & Customer Acquisition output", "Start with +10 Reputation"],
    },
    {
      key: "capitalist",
      name: "Capitalist",
      flavor: "You command capital. Raises land bigger and the bank account runs deep.",
      boosts: { fundraising: 1.8 },
      start: { cash: 320000 },
      perks: ["+80% Fundraising output", "Start with +$70k cash"],
    },
    {
      key: "architect",
      name: "Venture Architect",
      flavor: "You see the whole board. Balanced across origination, governance, and certainty.",
      boosts: { origination: 1.5, leadership: 1.5 },
      start: { cash: 250000, certainty: 18 },
      perks: ["+50% Origination & Leadership output", "Sharper conviction — faster Certainty gains"],
    },
  ];

  // Seven phases. `gate` returns null when the player may advance, else a string
  // describing what is still required.
  const PHASES = [
    {
      key: "discovery",
      name: "Opportunity Discovery",
      goal: "Find a real incumbent failure worth attacking.",
      gate: (s) => (s.certainty >= 25 ? null : `Certainty must reach 25 (now ${Math.round(s.certainty)})`),
    },
    {
      key: "qualification",
      name: "Qualification",
      goal: "Qualify the opportunity: market, customer, and incumbent weakness.",
      gate: (s) => (s.certainty >= 42 ? null : `Certainty must reach 42 (now ${Math.round(s.certainty)})`),
    },
    {
      key: "validation",
      name: "Validation",
      goal: "Validate customer pain with real conversations and design partners.",
      gate: (s) =>
        s.painSignals >= 3 && s.certainty >= 60
          ? null
          : `Need 3 strong pain signals (now ${s.painSignals}) and Certainty 60 (now ${Math.round(s.certainty)})`,
    },
    {
      key: "mvp",
      name: "MVP Build",
      goal: "Build a wedge product that solves the validated pain.",
      gate: (s) => (s.mvpBuilt ? null : "Build the MVP wedge to advance"),
    },
    {
      key: "revenue",
      name: "Revenue Validation",
      goal: "Convert pain into paying customers and real revenue.",
      gate: (s) =>
        s.customers >= 3 && s.mrr >= 6000
          ? null
          : `Need 3 customers (now ${s.customers}) and $6k MRR (now $${Math.round(s.mrr / 100) / 10}k)`,
    },
    {
      key: "scale",
      name: "Scale",
      goal: "Scale revenue and operations into a defensible business.",
      gate: (s) => (s.mrr >= 30000 ? null : `Need $30k MRR to be spinout-ready (now $${Math.round(s.mrr / 100) / 10}k)`),
    },
    {
      key: "spinout",
      name: "Spinout",
      goal: "Stand up the PortCo with a clean cap table and governance.",
      gate: () => "Finalize the spinout to end the game",
    },
  ];

  // Action library. Each action belongs to a phase. Effects are applied through
  // applyAction(), which routes contribution + certainty through archetype boosts
  // and the certainty soft-cap. `once` actions disappear after one use.
  const ACTIONS = [
    // -- Phase 1: Opportunity Discovery --
    { phase: "discovery", id: "scan", title: "Scan incumbent failures",
      desc: "Comb earnings calls, churn data, and 1-star reviews for cracks in a slow incumbent.",
      cash: -2000, time: 2, rep: 0, cert: 9, contrib: { origination: 8 } },
    { phase: "discovery", id: "insiders", title: "Interview industry insiders",
      desc: "Buy coffee for ex-employees and frustrated buyers. Borrow their pattern recognition.",
      cash: -5000, time: 3, rep: 3, cert: 11, contrib: { origination: 7, gtm: 3 } },
    { phase: "discovery", id: "valuechain", title: "Map the value chain",
      desc: "Diagram where money and frustration pool around the incumbent.",
      cash: -1500, time: 2, rep: 1, cert: 8, contrib: { origination: 6, leadership: 2 } },

    // -- Phase 2: Qualification --
    { phase: "qualification", id: "sizemarket", title: "Size the market",
      desc: "Bottom-up TAM/SAM. Is the wedge big enough to matter?",
      cash: -4000, time: 2, rep: 1, cert: 9, contrib: { origination: 6, fundraising: 3 } },
    { phase: "qualification", id: "icp", title: "Define the ideal customer",
      desc: "Pin down exactly who bleeds the most from the incumbent's failure.",
      cash: -2000, time: 2, rep: 1, cert: 10, contrib: { gtm: 7 } },
    { phase: "qualification", id: "weakness", title: "Assess incumbent weakness",
      desc: "Pressure-test why the incumbent can't or won't fix this themselves.",
      cash: -3000, time: 2, rep: 2, cert: 11, contrib: { origination: 6, leadership: 4 } },

    // -- Phase 3: Validation --
    { phase: "validation", id: "discovery_calls", title: "Run customer discovery calls",
      desc: "Twenty problem interviews. Listen for unprompted, specific, repeated pain.",
      cash: -3000, time: 3, rep: 2, cert: 10, contrib: { gtm: 9 }, pain: 1 },
    { phase: "validation", id: "survey", title: "Run a pain-point survey",
      desc: "Quantify the pain across a wider sample to back up the interviews.",
      cash: -2500, time: 2, rep: 1, cert: 7, contrib: { gtm: 5, ops: 2 }, pain: 1 },
    { phase: "validation", id: "landing", title: "Smoke-test a landing page",
      desc: "Fake-door a value prop and measure who tries to buy something that doesn't exist yet.",
      cash: -3500, time: 2, rep: 1, cert: 8, contrib: { product: 4, gtm: 5 }, pain: 1 },
    { phase: "validation", id: "design_partners", title: "Recruit design partners",
      desc: "Sign 2–3 customers to co-build the wedge. The strongest possible pain signal.",
      cash: -6000, time: 3, rep: 5, cert: 12, contrib: { partnerships: 9, gtm: 3 }, pain: 2, repReq: 45 },

    // -- Phase 4: MVP Build --
    { phase: "mvp", id: "wedge", title: "Define the wedge",
      desc: "Scope the smallest product that solves one acute job end-to-end.",
      cash: -2000, time: 2, rep: 1, cert: 4, contrib: { product: 6, leadership: 3 } },
    { phase: "mvp", id: "team", title: "Recruit a technical team",
      desc: "Bring on the people who can actually ship the wedge.",
      cash: -18000, time: 3, rep: 3, cert: 3, contrib: { product: 6, leadership: 5, partnerships: 2 } },
    { phase: "mvp", id: "build", title: "Build the MVP wedge", once: true,
      desc: "Heads-down construction of the first real product. Unlocks Revenue Validation.",
      cash: -45000, time: 8, rep: 4, cert: 6, contrib: { product: 18 }, sets: "mvpBuilt" },
    { phase: "mvp", id: "iterate", title: "Iterate on partner feedback",
      desc: "Tighten the wedge against what design partners actually do with it.",
      cash: -6000, time: 2, rep: 2, cert: 6, contrib: { product: 7, gtm: 2 } },

    // -- Phase 5: Revenue Validation --
    { phase: "revenue", id: "pilot", title: "Launch paid pilots",
      desc: "Turn design partners into paying pilots. Money is the only real validation.",
      cash: -5000, time: 3, rep: 3, cert: 5, contrib: { gtm: 8, ops: 3 }, customers: 2, mrr: 3500 },
    { phase: "revenue", id: "first_contract", title: "Close a flagship contract",
      desc: "Land one logo big enough to anchor the narrative and the bank account.",
      cash: -4000, time: 3, rep: 5, cert: 5, contrib: { gtm: 9, fundraising: 2 }, customers: 1, mrr: 5000, repReq: 50 },
    { phase: "revenue", id: "onboard", title: "Onboard & deliver",
      desc: "Make the first customers wildly successful so they renew and refer.",
      cash: -3000, time: 2, rep: 4, cert: 4, contrib: { ops: 9 }, mrr: 1500 },
    { phase: "revenue", id: "channel", title: "Form a channel partnership",
      desc: "Borrow an established partner's distribution to reach customers faster.",
      cash: -4000, time: 3, rep: 4, cert: 4, contrib: { partnerships: 9, gtm: 3 }, customers: 2, mrr: 2500, repReq: 55 },

    // -- Phase 6: Scale --
    { phase: "scale", id: "gtm_engine", title: "Build the GTM engine",
      desc: "Hire reps and wire up a repeatable pipeline. Compounds revenue.",
      cash: -30000, time: 4, rep: 2, cert: 3, contrib: { gtm: 12 }, mrrMult: 1.4 },
    { phase: "scale", id: "scale_ops", title: "Scale delivery operations",
      desc: "Systematize onboarding and support so growth doesn't break delivery.",
      cash: -16000, time: 3, rep: 3, cert: 3, contrib: { ops: 12, leadership: 3 }, mrr: 4000 },
    { phase: "scale", id: "expand_product", title: "Expand the product surface",
      desc: "Add the second and third jobs-to-be-done. Raise expansion revenue.",
      cash: -20000, time: 4, rep: 2, cert: 3, contrib: { product: 11 }, mrrMult: 1.25 },
    { phase: "scale", id: "seed_round", title: "Raise a seed round", once: true,
      desc: "Trade equity narrative for fuel. Refills cash and proves market confidence.",
      cash: 600000, time: 4, rep: 6, cert: 4, contrib: { fundraising: 16, leadership: 4 }, repReq: 60 },

    // -- Phase 7: Spinout --
    { phase: "spinout", id: "captable", title: "Assemble the cap table",
      desc: "Allocate ownership across founders, studio, and team by contribution.",
      cash: -5000, time: 2, rep: 2, cert: 2, contrib: { leadership: 8, fundraising: 3 } },
    { phase: "spinout", id: "governance", title: "Set up governance",
      desc: "Board, options pool, and the operating agreement for the new PortCo.",
      cash: -6000, time: 2, rep: 3, cert: 2, contrib: { leadership: 9, ops: 3 } },
    { phase: "spinout", id: "finalize", title: "Finalize the spinout", once: true,
      desc: "Sign the docs and stand up the PortCo. Ends the game and scores your run.",
      cash: -4000, time: 2, rep: 5, cert: 0, contrib: { leadership: 6, fundraising: 4 }, sets: "spunOut" },
  ];

  // Random flavor events. Fire occasionally after an action to add texture.
  const EVENTS = [
    { msg: "An incumbent press release validates your thesis — Certainty up.", cert: 6 },
    { msg: "A discovery call turns into a glowing referral — Reputation up.", rep: 4 },
    { msg: "A competitor fumbles a launch. The window widens.", cert: 5, rep: 2 },
    { msg: "Scope creep eats a week of runway.", time: 2 },
    { msg: "An unexpected legal review costs a little cash.", cash: -4000 },
    { msg: "A design partner tweets your demo — inbound interest.", rep: 5 },
    { msg: "A key hire negotiation drags on, burning time.", time: 1, rep: -1 },
    { msg: "A mentor intro lands — sharper conviction.", cert: 4, rep: 2 },
  ];

  const OUTCOMES = {
    failed: { name: "Failed Venture", color: "#e8786f", bg: "#34201a",
      verdict: "The thesis didn't survive contact with reality. The studio absorbs the lesson and moves on — most arbitrage bets end here, and that's the model working." },
    zombie: { name: "Zombie Startup", color: "#c79ae0", bg: "#241c30",
      verdict: "Alive but not growing. There's revenue and a product, but not enough velocity to justify a real spinout. It limps onward." },
    lifestyle: { name: "Lifestyle Business", color: "#e0d06f", bg: "#2a2710",
      verdict: "A genuinely good small business — profitable, durable, and modest. It will pay its people well without ever swinging for venture scale." },
    growth: { name: "Growth Company", color: "#7ed6a0", bg: "#16271d",
      verdict: "A real, growing PortCo with validated revenue. The wedge worked and the machine is compounding. A clean studio win." },
    acquisition: { name: "Acquisition Target", color: "#6fc3ff", bg: "#16242c",
      verdict: "Strong revenue, strong relationships — the kind of company incumbents and platforms want to buy. The arbitrage came full circle." },
    champion: { name: "Venture Studio Champion", color: "#8fd18f", bg: "#16271d",
      verdict: "Disciplined validation, deep contribution across every category, and breakout revenue. This is the outcome the whole model exists to produce." },
  };

  // Ordinal quality of each outcome (failed worst → champion best). Used by the
  // playtester's default reward; lives here because it's game knowledge.
  const OUTCOME_RANK = {
    failed: 0, zombie: 1, lifestyle: 2, growth: 3, acquisition: 4, champion: 5,
  };

  /* --- Helpers ------------------------------------------------------------ */

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  function archetypeByKey(key) { return ARCHETYPES.find((a) => a.key === key); }
  function actionById(id) { return ACTIONS.find((a) => a.id === id); }

  // mulberry32 — a tiny seedable PRNG so simulations are reproducible and a
  // candidate policy can be averaged over a fixed set of seeds.
  function makeRng(seed) {
    let t = (seed >>> 0) || 1;
    return function () {
      t += 0x6d2b79f5;
      let x = t;
      x = Math.imul(x ^ (x >>> 15), x | 1);
      x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* --- State -------------------------------------------------------------- */

  // Produces the pure simulation state (no UI fields like screen/log/lastDeltas;
  // those are layered on by app.js). `done`, `outcome`, `endReason` track the end.
  function makeInitialState(archetypeKey) {
    const archetype = archetypeByKey(archetypeKey);
    const s = {
      archetype: archetype.key,
      cash: 250000,
      time: 104, // weeks of runway remaining
      maxTime: 104,
      reputation: 50,
      certainty: 8,
      phaseIndex: 0,
      painSignals: 0,
      customers: 0,
      mrr: 0,
      mvpBuilt: false,
      spunOut: false,
      contrib: Object.fromEntries(CATEGORIES.map((c) => [c.key, 0])),
      usedOnce: {},
      week: 0,
      done: false,
      outcome: null,
      endReason: null,
    };
    const st = archetype.start || {};
    if (st.cash != null) s.cash = st.cash;
    if (st.time != null) { s.time = st.time; s.maxTime = st.time; }
    if (st.reputation != null) s.reputation = st.reputation;
    if (st.certainty != null) s.certainty = st.certainty;
    return s;
  }

  // Shallow-but-safe clone of the simulation fields only. Used by step() so search
  // and rollouts never mutate the caller's state. UI-only fields are intentionally
  // dropped — the engine never reads them.
  function cloneState(s) {
    return {
      archetype: s.archetype,
      cash: s.cash, time: s.time, maxTime: s.maxTime,
      reputation: s.reputation, certainty: s.certainty,
      phaseIndex: s.phaseIndex,
      painSignals: s.painSignals, customers: s.customers, mrr: s.mrr,
      mvpBuilt: s.mvpBuilt, spunOut: s.spunOut,
      contrib: Object.assign({}, s.contrib),
      usedOnce: Object.assign({}, s.usedOnce),
      week: s.week,
      done: s.done, outcome: s.outcome, endReason: s.endReason,
    };
  }

  /* --- Game mechanics ----------------------------------------------------- */

  // Certainty has a soft cap at 100: each raw gain is scaled by remaining headroom
  // so early conviction is cheap and the last few points are hard-won.
  function applyCertainty(s, raw, archetypeBoost) {
    const headroom = 1 - s.certainty / 100;
    const boosted = raw * archetypeBoost;
    s.certainty = clamp(s.certainty + boosted * headroom, 0, 100);
  }

  function canAfford(s, a) {
    if (a.cash < 0 && s.cash + a.cash < 0) return false;
    if (a.time > 0 && s.time - a.time < 0) return false;
    if (a.repReq != null && s.reputation < a.repReq) return false;
    return true;
  }

  // Apply an action to `s` IN PLACE. Returns a result describing what happened so
  // a UI can log/render it: { applied, deltas, event, ended, endReason }.
  // No DOM, no logging — those are the caller's concern.
  function applyAction(s, a, rng) {
    rng = rng || Math.random;
    if (s.done || !canAfford(s, a)) return { applied: false };
    const arch = archetypeByKey(s.archetype);
    const deltas = {};

    // Cash + time.
    if (a.cash) { s.cash += a.cash; deltas.cash = a.cash; }
    if (a.time) { s.time -= a.time; s.week += a.time; deltas.time = -a.time; }

    // Reputation.
    if (a.rep) { s.reputation = clamp(s.reputation + a.rep, 0, 100); deltas.reputation = a.rep; }

    // Certainty (archetype "architect" gets a global certainty edge).
    if (a.cert) {
      const before = s.certainty;
      const certBoost = arch.key === "architect" ? 1.25 : 1;
      applyCertainty(s, a.cert, certBoost);
      deltas.certainty = s.certainty - before;
    }

    // Contribution, routed through per-category archetype boosts.
    if (a.contrib) {
      for (const k in a.contrib) {
        const boost = (arch.boosts && arch.boosts[k]) || 1;
        s.contrib[k] += a.contrib[k] * boost;
      }
    }

    // Domain effects.
    if (a.pain) s.painSignals += a.pain;
    if (a.customers) s.customers += a.customers;
    if (a.mrr) s.mrr += a.mrr;
    if (a.mrrMult) s.mrr = Math.round(s.mrr * a.mrrMult);
    if (a.sets) s[a.sets] = true;
    if (a.once) s.usedOnce[a.id] = true;

    // Spinout finalize ends the game immediately (before any event/failure check).
    if (a.id === "finalize") {
      endGame(s, "spinout");
      return { applied: true, deltas, event: null, ended: true, endReason: s.endReason };
    }

    // Random event (~28% chance), then check failure conditions.
    const event = maybeEvent(s, rng);
    checkFailure(s);
    return { applied: true, deltas, event, ended: s.done, endReason: s.endReason };
  }

  // Returns the event that fired (so a UI can log/flash it), or null.
  function maybeEvent(s, rng) {
    if (s.spunOut) return null;
    if (rng() > 0.28) return null;
    const ev = EVENTS[Math.floor(rng() * EVENTS.length)];
    if (ev.cash) s.cash += ev.cash;
    if (ev.time) { s.time -= ev.time; s.week += ev.time; }
    if (ev.rep) s.reputation = clamp(s.reputation + ev.rep, 0, 100);
    if (ev.cert) applyCertainty(s, ev.cert, 1);
    return ev;
  }

  function checkFailure(s) {
    if (s.spunOut || s.done) return;
    const phase = PHASES[s.phaseIndex];
    // Out of runway, or out of cash with no way to act in an early phase.
    if (s.time <= 0) { endGame(s, "timeout"); return; }
    if (s.cash < 1500 && phase.key !== "scale" && phase.key !== "spinout") { endGame(s, "broke"); return; }
    // Stalemate: every action is unaffordable and the phase gate isn't met, so the
    // run can't progress. End it rather than soft-locking.
    const acts = ACTIONS.filter((a) => a.phase === phase.key && !(a.once && s.usedOnce[a.id]));
    if (!acts.some((a) => canAfford(s, a)) && phase.gate(s) !== null) {
      endGame(s, s.cash < 10000 ? "broke" : "timeout");
    }
  }

  // Advance the phase IN PLACE if the gate is met. Returns { advanced, phase }.
  function advancePhase(s) {
    const phase = PHASES[s.phaseIndex];
    if (s.done || phase.gate(s) !== null) return { advanced: false };
    if (s.phaseIndex < PHASES.length - 1) {
      s.phaseIndex++;
      return { advanced: true, phase: PHASES[s.phaseIndex] };
    }
    return { advanced: false };
  }

  /* --- Scoring + endgame -------------------------------------------------- */

  function weightedContribution(s) {
    // Normalize each category to a 0..100-ish scale then weight it.
    let total = 0;
    for (const c of CATEGORIES) {
      const v = s.contrib[c.key];
      total += Math.min(100, v) * c.weight;
    }
    return total; // roughly 0..100
  }

  function determineOutcome(s, reason) {
    const score = weightedContribution(s);
    const mrr = s.mrr;
    const annual = mrr * 12;

    if (reason === "timeout" || reason === "broke") {
      if (mrr >= 6000 && s.mvpBuilt) return { key: "zombie", score, annual };
      return { key: "failed", score, annual };
    }
    // Spun out — grade on revenue, contribution, and reputation.
    if (mrr >= 90000 && score >= 55 && s.reputation >= 65) return { key: "champion", score, annual };
    if (mrr >= 70000 && (score >= 45 || s.reputation >= 70)) return { key: "acquisition", score, annual };
    if (mrr >= 45000) return { key: "growth", score, annual };
    if (mrr >= 18000) return { key: "lifestyle", score, annual };
    if (mrr >= 6000) return { key: "zombie", score, annual };
    return { key: "failed", score, annual };
  }

  function endGame(s, reason) {
    s.outcome = determineOutcome(s, reason);
    s.endReason = reason;
    s.done = true;
  }

  /* --- Agent-facing API --------------------------------------------------- */

  // The agent's action space at a state: affordable, phase-appropriate, not
  // already-used-once actions, plus "advance" when the gate is clear and there is
  // a next phase. Returns an array of move ids (action ids or the string "advance").
  function legalMoves(s) {
    if (s.done) return [];
    const phase = PHASES[s.phaseIndex];
    const moves = ACTIONS
      .filter((a) => a.phase === phase.key && !(a.once && s.usedOnce[a.id]) && canAfford(s, a))
      .map((a) => a.id);
    if (phase.gate(s) === null && s.phaseIndex < PHASES.length - 1) moves.push("advance");
    return moves;
  }

  // Pure transition: clones `state`, applies a move, returns the next state +
  // terminal info. Never mutates the caller's state. `moveId` is an action id or
  // "advance".
  function step(state, moveId, rng) {
    const next = cloneState(state);
    let result;
    if (moveId === "advance") {
      result = advancePhase(next);
    } else {
      const a = actionById(moveId);
      result = a ? applyAction(next, a, rng) : { applied: false };
    }
    return { state: next, done: !!next.done, outcome: next.outcome, result };
  }

  // Run a full game. `policyFn(state, legalMoves, rng) -> moveId` chooses each move.
  // Returns { outcome, finalState, moveTrace }. Always terminates (every action
  // spends time; the step cap is a safety net).
  function playEpisode(archetypeKey, policyFn, rng, opts) {
    opts = opts || {};
    rng = rng || Math.random;
    const cap = opts.maxSteps || 300;
    let s = makeInitialState(archetypeKey);
    const trace = [];
    let steps = 0;
    while (!s.done && steps < cap) {
      const moves = legalMoves(s);
      if (moves.length === 0) { endGame(s, s.cash < 10000 ? "broke" : "timeout"); break; }
      const moveId = policyFn(s, moves, rng);
      trace.push({ move: moveId, phaseIndex: s.phaseIndex });
      const res = step(s, moveId, rng);
      s = res.state;
      steps++;
    }
    if (!s.done) endGame(s, s.cash < 10000 ? "broke" : "timeout");
    return { outcome: s.outcome, finalState: s, moveTrace: trace };
  }

  /* --- Exports ------------------------------------------------------------ */

  return {
    // config
    CATEGORIES, ARCHETYPES, PHASES, ACTIONS, EVENTS, OUTCOMES, OUTCOME_RANK,
    // lookups + utils
    clamp, archetypeByKey, actionById, makeRng,
    // state
    makeInitialState, cloneState,
    // mechanics (operate in place on a state)
    applyCertainty, canAfford, applyAction, maybeEvent, checkFailure,
    advancePhase, endGame,
    // scoring
    weightedContribution, determineOutcome,
    // agent-facing
    legalMoves, step, playEpisode,
  };
});
