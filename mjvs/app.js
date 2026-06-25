/* =============================================================================
   MJ Venture Studio — Incumbent Failure Arbitrage Studio Simulator
   A single-player, turn-based venture studio game. The player is a Studio
   Principal who turns an incumbent's failure into a spun-out PortCo across
   seven phases by spending Cash + Time and growing Reputation + Certainty,
   while accumulating contribution across seven categories.

   Self-contained, no build step. Renders into #app. Based on docs/mjvs.md.
   ========================================================================== */
(function () {
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
  // gain values: cash (negative = spend), time (weeks spent, positive number),
  // rep (reputation delta), cert (raw certainty gain before soft-cap),
  // contrib: { categoryKey: points }, plus optional pain/customers/mrr deltas.
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

  /* --- State -------------------------------------------------------------- */

  let state = null;

  function makeInitialState(archetype) {
    const base = {
      screen: "play",
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
      log: [],
      week: 0,
      lastDeltas: {},
    };
    // Apply archetype starting tweaks.
    const st = archetype.start || {};
    if (st.cash != null) base.cash = st.cash;
    if (st.time != null) { base.time = st.time; base.maxTime = st.time; }
    if (st.reputation != null) base.reputation = st.reputation;
    if (st.certainty != null) base.certainty = st.certainty;
    logTo(base, `You begin as a ${archetype.name}. ${archetype.flavor}`, "event");
    return base;
  }

  function currentArchetype() {
    return ARCHETYPES.find((a) => a.key === state.archetype);
  }

  function logTo(st, msg, kind) {
    st.log.unshift({ week: st.week, msg, kind: kind || "" });
    if (st.log.length > 60) st.log.pop();
  }

  /* --- Game mechanics ----------------------------------------------------- */

  // Certainty has a soft cap at 100: each raw gain is scaled by remaining headroom
  // so early conviction is cheap and the last few points are hard-won.
  function applyCertainty(raw, archetypeBoost) {
    const headroom = 1 - state.certainty / 100;
    const boosted = raw * archetypeBoost;
    state.certainty = clamp(state.certainty + boosted * headroom, 0, 100);
  }

  function canAfford(a) {
    if (a.cash < 0 && state.cash + a.cash < 0) return false;
    if (a.time > 0 && state.time - a.time < 0) return false;
    if (a.repReq != null && state.reputation < a.repReq) return false;
    return true;
  }

  function applyAction(a) {
    if (!canAfford(a)) return;
    const arch = currentArchetype();
    const deltas = {};

    // Cash + time.
    if (a.cash) { state.cash += a.cash; deltas.cash = a.cash; }
    if (a.time) { state.time -= a.time; state.week += a.time; deltas.time = -a.time; }

    // Reputation.
    if (a.rep) { state.reputation = clamp(state.reputation + a.rep, 0, 100); deltas.reputation = a.rep; }

    // Certainty (archetype "architect" gets a global certainty edge).
    if (a.cert) {
      const before = state.certainty;
      const certBoost = arch.key === "architect" ? 1.25 : 1;
      applyCertainty(a.cert, certBoost);
      deltas.certainty = state.certainty - before;
    }

    // Contribution, routed through per-category archetype boosts.
    if (a.contrib) {
      for (const k in a.contrib) {
        const boost = (arch.boosts && arch.boosts[k]) || 1;
        state.contrib[k] += a.contrib[k] * boost;
      }
    }

    // Domain effects.
    if (a.pain) state.painSignals += a.pain;
    if (a.customers) state.customers += a.customers;
    if (a.mrr) state.mrr += a.mrr;
    if (a.mrrMult) state.mrr = Math.round(state.mrr * a.mrrMult);
    if (a.sets) state[a.sets] = true;
    if (a.once) state.usedOnce[a.id] = true;

    state.lastDeltas = deltas;
    logTo(state, actionSummary(a), a.cash > 0 ? "good" : "");

    // Spinout finalize ends the game immediately.
    if (a.id === "finalize") { endGame("spinout"); return; }

    // Random event (~28% chance), then check failure conditions.
    maybeEvent();
    checkFailure();
    render();
  }

  function actionSummary(a) {
    const bits = [];
    if (a.cash) bits.push((a.cash > 0 ? "+" : "−") + "$" + fmtK(Math.abs(a.cash)));
    if (a.time) bits.push(a.time + "w");
    if (a.pain) bits.push("+" + a.pain + " pain signal" + (a.pain > 1 ? "s" : ""));
    if (a.customers) bits.push("+" + a.customers + " customer" + (a.customers > 1 ? "s" : ""));
    if (a.mrr) bits.push("+$" + fmtK(a.mrr) + " MRR");
    if (a.mrrMult) bits.push("×" + a.mrrMult + " MRR");
    return a.title + (bits.length ? " (" + bits.join(", ") + ")" : "");
  }

  function maybeEvent() {
    if (state.spunOut) return;
    // Deterministic-ish: use week + cash as a cheap PRNG seed so it varies.
    const roll = Math.random();
    if (roll > 0.28) return;
    const ev = EVENTS[Math.floor(Math.random() * EVENTS.length)];
    if (ev.cash) state.cash += ev.cash;
    if (ev.time) { state.time -= ev.time; state.week += ev.time; }
    if (ev.rep) state.reputation = clamp(state.reputation + ev.rep, 0, 100);
    if (ev.cert) applyCertainty(ev.cert, 1);
    logTo(state, "⚡ " + ev.msg, "event");
    flash(ev.msg);
  }

  function checkFailure() {
    if (state.spunOut || state.screen === "end") return;
    const phase = PHASES[state.phaseIndex];
    // Out of runway, or out of cash with no way to act in an early phase.
    if (state.time <= 0) { endGame("timeout"); return; }
    if (state.cash < 1500 && phase.key !== "scale" && phase.key !== "spinout") { endGame("broke"); return; }
    // Stalemate: every action is unaffordable and the phase gate isn't met, so
    // the run can't progress. End it rather than soft-locking the player.
    const acts = ACTIONS.filter((a) => a.phase === phase.key && !(a.once && state.usedOnce[a.id]));
    if (!acts.some((a) => canAfford(a)) && phase.gate(state) !== null) {
      endGame(state.cash < 10000 ? "broke" : "timeout");
    }
  }

  function advancePhase() {
    const phase = PHASES[state.phaseIndex];
    if (phase.gate(state) !== null) return;
    if (state.phaseIndex < PHASES.length - 1) {
      state.phaseIndex++;
      const next = PHASES[state.phaseIndex];
      logTo(state, `▶ Advanced to Phase ${state.phaseIndex + 1}: ${next.name}.`, "good");
      flash("Phase " + (state.phaseIndex + 1) + ": " + next.name);
      render();
    }
  }

  /* --- Scoring + endgame -------------------------------------------------- */

  function weightedContribution() {
    // Normalize each category to a 0..100-ish scale then weight it.
    let total = 0;
    for (const c of CATEGORIES) {
      const v = state.contrib[c.key];
      total += Math.min(100, v) * c.weight;
    }
    return total; // roughly 0..100
  }

  function determineOutcome(reason) {
    const score = weightedContribution();
    const mrr = state.mrr;
    const annual = mrr * 12;

    if (reason === "timeout" || reason === "broke") {
      if (mrr >= 6000 && state.mvpBuilt) {
        return outcome("zombie");
      }
      return outcome("failed");
    }
    // Spun out — grade on revenue, contribution, and reputation.
    if (mrr >= 90000 && score >= 55 && state.reputation >= 65) return outcome("champion");
    if (mrr >= 70000 && (score >= 45 || state.reputation >= 70)) return outcome("acquisition");
    if (mrr >= 45000) return outcome("growth");
    if (mrr >= 18000) return outcome("lifestyle");
    if (mrr >= 6000) return outcome("zombie");
    return outcome("failed");

    function outcome(key) {
      return { key, score, annual };
    }
  }

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

  function endGame(reason) {
    state.outcome = determineOutcome(reason);
    state.endReason = reason;
    state.screen = "end";
    const o = OUTCOMES[state.outcome.key];
    logTo(state, `★ Endgame: ${o.name}.`, "event");
    render();
  }

  /* --- Rendering ---------------------------------------------------------- */

  const app = document.getElementById("app");

  function render() {
    if (!state || state.screen === "select") return renderSelect();
    if (state.screen === "end") return renderEnd();
    return renderPlay();
  }

  function renderSelect() {
    const sel = state && state.pendingArch;
    app.innerHTML = `
      <div class="intro">
        <h2>Choose your Studio Principal</h2>
        <p>You run an <b>Incumbent Failure Arbitrage Studio</b>. Somewhere a slow,
        comfortable incumbent is failing its customers. Your job: find that failure,
        validate the pain, build a wedge, win revenue, and spin out a PortCo — without
        running out of <b>Cash</b> or <b>Runway</b>.</p>
        <p>Your archetype shapes which kind of work pays off most. There's no single
        right path; ownership follows contribution.</p>
      </div>
      <div class="archetypes">
        ${ARCHETYPES.map((a) => `
          <div class="arch-card${sel === a.key ? " selected" : ""}" data-arch="${a.key}">
            <h3>${a.name}</h3>
            <p class="arch-flavor">${a.flavor}</p>
            ${a.perks.map((p) => `<p class="arch-perk">✓ ${p}</p>`).join("")}
          </div>`).join("")}
      </div>
      <div class="start-row">
        <button class="btn btn-go" id="start-btn" ${sel ? "" : "disabled"}>
          ${sel ? "Begin as " + ARCHETYPES.find((a) => a.key === sel).name : "Select an archetype"}
        </button>
      </div>`;
  }

  function statBlock(label, value, opts) {
    opts = opts || {};
    const cls = opts.danger ? " danger" : opts.warn ? " warn" : "";
    const meter = opts.meter != null
      ? `<div class="meter"><span style="width:${clamp(opts.meter, 0, 100)}%;background:${opts.meterColor || "#2c8aa8"}"></span></div>`
      : "";
    const delta = opts.delta ? `<div class="delta">${opts.delta}</div>` : `<div class="delta"></div>`;
    return `<div class="stat"><div class="label">${label}</div>
      <div class="value${cls}">${value}</div>${meter}${delta}</div>`;
  }

  function renderPlay() {
    const phase = PHASES[state.phaseIndex];
    const gateMsg = phase.gate(state);
    const ready = gateMsg === null;
    const d = state.lastDeltas || {};

    const timePct = (state.time / state.maxTime) * 100;
    const cashWarn = state.cash < 30000;

    const hud = `
      <div class="hud">
        ${statBlock("Cash", "$" + fmtK(state.cash), {
          danger: state.cash < 10000, warn: cashWarn && state.cash >= 10000,
          delta: d.cash ? (d.cash > 0 ? "+" : "−") + "$" + fmtK(Math.abs(d.cash)) : "",
        })}
        ${statBlock("Runway", Math.max(0, Math.round(state.time)) + "w", {
          danger: state.time < 12, warn: state.time < 26 && state.time >= 12,
          meter: timePct, meterColor: state.time < 12 ? "#e8786f" : "#2c8aa8",
          delta: d.time ? d.time + "w" : "",
        })}
        ${statBlock("Reputation", Math.round(state.reputation), {
          meter: state.reputation, meterColor: "#e08fb0",
          delta: d.reputation ? (d.reputation > 0 ? "+" : "") + Math.round(d.reputation) : "",
        })}
        ${statBlock("Certainty", Math.round(state.certainty), {
          meter: state.certainty, meterColor: "#7ed6a0",
          delta: d.certainty ? (d.certainty > 0 ? "+" : "") + (Math.round(d.certainty * 10) / 10) : "",
        })}
      </div>`;

    const stepper = `
      <div class="stepper">
        ${PHASES.map((p, i) => `
          <div class="step ${i < state.phaseIndex ? "done" : i === state.phaseIndex ? "current" : ""}">
            <span class="n">PHASE ${i + 1}</span>${p.name}
          </div>`).join("")}
      </div>`;

    const acts = ACTIONS.filter((a) => a.phase === phase.key && !(a.once && state.usedOnce[a.id]));
    const actionList = acts.map((a) => {
      const affordable = canAfford(a);
      return `
        <div class="action${affordable ? "" : " locked"}">
          <div class="action-text">
            <h4>${a.title}</h4>
            <p>${a.desc}</p>
            <div class="action-costs">${costChips(a)}</div>
          </div>
          <div class="action-go">
            <button class="btn" data-act="${a.id}" ${affordable ? "" : "disabled"}>
              ${a.cash > 0 ? "Raise" : "Do it"}
            </button>
          </div>
        </div>`;
    }).join("");

    const businessLine = (state.mvpBuilt || state.customers || state.mrr)
      ? `<div class="sub" style="margin-top:10px">
           ${state.mvpBuilt ? "MVP shipped · " : ""}${state.customers} customers · $${fmtK(state.mrr)} MRR · ${state.painSignals} pain signals
         </div>`
      : `<div class="sub" style="margin-top:10px">${state.painSignals} pain signals gathered</div>`;

    const main = `
      <div>
        <div class="panel">
          <h2 class="section-title">Phase ${state.phaseIndex + 1} — ${phase.name}</h2>
          <p class="sub">${phase.goal}</p>
          ${stepper}
        </div>
        <div class="panel">
          <h2 class="section-title">Actions</h2>
          <p class="sub">Each action spends resources and advances the venture. Spend wisely — runway is finite.</p>
          <div class="action-list">${actionList}</div>
          ${businessLine}
          <div class="gate ${ready ? "ready" : ""}">
            <div class="gate-text">
              <b>Advance to next phase</b><br>
              <span class="req">${ready ? "✓ Requirements met — you're clear to advance." : "Locked: " + gateMsg}</span>
            </div>
            <button class="btn btn-go" id="advance-btn" ${ready ? "" : "disabled"}>
              ${state.phaseIndex === PHASES.length - 1 ? "Finalize below" : "Advance →"}
            </button>
          </div>
        </div>
      </div>`;

    const side = `
      <div>
        <div class="panel">
          <h2 class="section-title">Contribution</h2>
          <p class="sub">Ownership follows contribution across the seven studio categories.</p>
          ${contribBars()}
          <div class="score-line">
            <span>Weighted contribution score</span>
            <b>${Math.round(weightedContribution())}</b>
          </div>
        </div>
        <div class="panel">
          <h2 class="section-title">Activity log</h2>
          <div class="log">
            ${state.log.map((e) => `
              <div class="log-entry ${e.kind}"><span class="when">W${e.week}</span>${e.msg}</div>`).join("")}
          </div>
        </div>
        <div class="panel" style="text-align:center">
          <button class="btn btn-ghost" id="restart-btn">Restart run</button>
        </div>
      </div>`;

    app.innerHTML = `${hud}<div class="game-grid">${main}${side}</div>`;
  }

  function contribBars() {
    return CATEGORIES.map((c) => {
      const v = state.contrib[c.key];
      const pct = Math.min(100, v);
      return `
        <div class="contrib-row">
          <span class="cname">${c.label} <small>(${Math.round(c.weight * 100)}%)</small></span>
          <span class="contrib-val">${Math.round(v)}</span>
        </div>
        <div class="contrib-bar"><span style="width:${pct}%;background:${c.color}"></span></div>`;
    }).join("");
  }

  function costChips(a) {
    const chips = [];
    if (a.cash) chips.push(`<span class="cost-chip ${a.cash > 0 ? "pos" : "neg"}">${a.cash > 0 ? "+" : "−"}$${fmtK(Math.abs(a.cash))}</span>`);
    if (a.time) chips.push(`<span class="cost-chip neg">${a.time}w</span>`);
    if (a.repReq != null) chips.push(`<span class="cost-chip">needs ${a.repReq} rep</span>`);
    if (a.cert) chips.push(`<span class="cost-chip pos">+certainty</span>`);
    if (a.rep > 0) chips.push(`<span class="cost-chip pos">+${a.rep} rep</span>`);
    if (a.pain) chips.push(`<span class="cost-chip pos">+${a.pain} pain</span>`);
    if (a.customers) chips.push(`<span class="cost-chip pos">+${a.customers} cust</span>`);
    if (a.mrr) chips.push(`<span class="cost-chip pos">+$${fmtK(a.mrr)} MRR</span>`);
    if (a.mrrMult) chips.push(`<span class="cost-chip pos">×${a.mrrMult} MRR</span>`);
    if (a.sets === "mvpBuilt") chips.push(`<span class="cost-chip">ships MVP</span>`);
    return chips.join("");
  }

  function renderEnd() {
    const o = OUTCOMES[state.outcome.key];
    const arch = currentArchetype();
    app.innerHTML = `
      <div class="endgame">
        <span class="outcome-badge" style="color:${o.color};background:${o.bg};border:1px solid ${o.color}">
          ${state.endReason === "timeout" ? "Out of runway" : state.endReason === "broke" ? "Out of cash" : "Spinout reached"}
        </span>
        <h2 style="color:${o.color}">${o.name}</h2>
        <p class="verdict">${o.verdict}</p>
        <div class="scorecard">
          ${statBlock("Reached", PHASES[state.phaseIndex].name, {})}
          ${statBlock("MRR", "$" + fmtK(state.mrr), {})}
          ${statBlock("Est. ARR", "$" + fmtK(state.outcome.annual), {})}
          ${statBlock("Customers", state.customers, {})}
          ${statBlock("Contribution", Math.round(state.outcome.score), {})}
          ${statBlock("Reputation", Math.round(state.reputation), {})}
          ${statBlock("Weeks elapsed", state.week, {})}
          ${statBlock("Played as", arch.name, {})}
        </div>
        <div class="panel" style="text-align:left;max-width:560px;margin:0 auto 22px">
          <h2 class="section-title">Final contribution breakdown</h2>
          ${contribBars()}
        </div>
        <button class="btn btn-go" id="restart-btn">Play again</button>
      </div>`;
  }

  /* --- Flash toast -------------------------------------------------------- */
  let flashTimer = null;
  function flash(msg, bad) {
    let el = document.getElementById("flash");
    if (!el) {
      el = document.createElement("div");
      el.id = "flash";
      el.className = "flash";
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.className = "flash show" + (bad ? " bad" : "");
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => { el.className = "flash" + (bad ? " bad" : ""); }, 2600);
  }

  /* --- Helpers ------------------------------------------------------------ */
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function fmtK(n) {
    n = Math.round(n);
    if (Math.abs(n) >= 1000) {
      const k = n / 1000;
      return (Math.abs(k) >= 100 ? Math.round(k) : Math.round(k * 10) / 10) + "k";
    }
    return String(n);
  }

  /* --- Event wiring (delegation) ----------------------------------------- */
  app.addEventListener("click", (e) => {
    const archCard = e.target.closest("[data-arch]");
    if (archCard) {
      state = state || { screen: "select" };
      state.pendingArch = archCard.getAttribute("data-arch");
      return renderSelect();
    }
    if (e.target.id === "start-btn" && state && state.pendingArch) {
      const arch = ARCHETYPES.find((a) => a.key === state.pendingArch);
      state = makeInitialState(arch);
      return render();
    }
    const actBtn = e.target.closest("[data-act]");
    if (actBtn && !actBtn.disabled) {
      const a = ACTIONS.find((x) => x.id === actBtn.getAttribute("data-act"));
      if (a) applyAction(a);
      return;
    }
    if (e.target.id === "advance-btn") return advancePhase();
    if (e.target.id === "restart-btn") {
      state = { screen: "select" };
      return renderSelect();
    }
  });

  /* --- Boot --------------------------------------------------------------- */
  state = { screen: "select" };
  renderSelect();
})();
