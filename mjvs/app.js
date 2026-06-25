/* =============================================================================
   MJ Venture Studio — UI layer
   The interactive game's presentation + input. All game RULES live in engine.js
   (globalThis.MJVSEngine); this file only renders state and forwards clicks into
   the engine, then logs/flashes/redraws. Keeping rules in one place means the
   playtester (playtest/) plays by exactly the same rules.

   Self-contained, no build step. Renders into #app. Loads after engine.js.
   ========================================================================== */
(function () {
  "use strict";

  const E = (typeof window !== "undefined" ? window : globalThis).MJVSEngine;
  const { CATEGORIES, ARCHETYPES, PHASES, ACTIONS, OUTCOMES } = E;
  const clamp = E.clamp;

  /* --- State (UI-owned wrapper around the engine sim state) --------------- */

  let state = null;

  // Build a fresh game: engine sim state + UI-only fields (screen, log, deltas).
  function newGame(archetypeKey) {
    const s = E.makeInitialState(archetypeKey);
    s.screen = "play";
    s.log = [];
    s.lastDeltas = {};
    const arch = E.archetypeByKey(archetypeKey);
    logTo(s, `You begin as a ${arch.name}. ${arch.flavor}`, "event");
    return s;
  }

  function currentArchetype() {
    return E.archetypeByKey(state.archetype);
  }

  function logTo(st, msg, kind) {
    st.log.unshift({ week: st.week, msg, kind: kind || "" });
    if (st.log.length > 60) st.log.pop();
  }

  /* --- Engine-driven turns ------------------------------------------------ */

  // Forward an action click into the engine, then handle UI side effects
  // (log entry, random-event flash, endgame) in the same order as the sim.
  function doAction(a) {
    const res = E.applyAction(state, a, Math.random);
    if (!res.applied) return;
    state.lastDeltas = res.deltas;
    logTo(state, actionSummary(a), a.cash > 0 ? "good" : "");
    if (res.event) { logTo(state, "⚡ " + res.event.msg, "event"); flash(res.event.msg); }
    if (state.done) finishGame();
    render();
  }

  function doAdvance() {
    const res = E.advancePhase(state);
    if (!res.advanced) return;
    logTo(state, `▶ Advanced to Phase ${state.phaseIndex + 1}: ${res.phase.name}.`, "good");
    flash("Phase " + (state.phaseIndex + 1) + ": " + res.phase.name);
    render();
  }

  // The engine has already set state.done/outcome/endReason; reflect it in the UI.
  function finishGame() {
    state.screen = "end";
    const o = OUTCOMES[state.outcome.key];
    logTo(state, `★ Endgame: ${o.name}.`, "event");
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
      const affordable = E.canAfford(state, a);
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
            <b>${Math.round(E.weightedContribution(state))}</b>
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
      state = newGame(state.pendingArch);
      return render();
    }
    const actBtn = e.target.closest("[data-act]");
    if (actBtn && !actBtn.disabled) {
      const a = ACTIONS.find((x) => x.id === actBtn.getAttribute("data-act"));
      if (a) doAction(a);
      return;
    }
    if (e.target.id === "advance-btn") return doAdvance();
    if (e.target.id === "restart-btn") {
      state = { screen: "select" };
      return renderSelect();
    }
  });

  /* --- Boot --------------------------------------------------------------- */
  state = { screen: "select" };
  renderSelect();
})();
