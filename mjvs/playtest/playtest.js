/* =============================================================================
   MJVS Playtester — UI
   Wires the controls to a training worker, draws live progress (training curve,
   outcome distribution), renders the discovered playbook per archetype and a
   cross-archetype leaderboard, and drives the Monte Carlo move inspector.
   ========================================================================== */
(function () {
  "use strict";

  const E = window.MJVSEngine;
  const S = window.MJVSStrategies;

  const $ = (id) => document.getElementById(id);
  const ARCH_NAME = {};
  E.ARCHETYPES.forEach((a) => { ARCH_NAME[a.key] = a.name; });

  // Per-archetype live store: { history, dist, best, status, result, el:{...} }.
  let store = {};
  let worker = null;
  let running = false;

  /* --- Populate the strategy + reward dropdowns from the registries ------- */
  function populateSelects() {
    const strat = $("strategy");
    Object.keys(S.STRATEGIES).forEach((key) => {
      const s = S.STRATEGIES[key];
      const opt = document.createElement("option");
      opt.value = key;
      opt.textContent = s.label + (s.implemented ? "" : " (coming soon)");
      opt.disabled = !s.implemented;
      strat.appendChild(opt);
    });
    strat.value = "evolutionary";

    const rew = $("reward");
    Object.keys(S.REWARDS).forEach((key) => {
      const r = S.REWARDS[key];
      const opt = document.createElement("option");
      opt.value = key;
      opt.textContent = r.label;
      rew.appendChild(opt);
    });
    rew.value = "tier";

    updateDescs();
  }

  function updateDescs() {
    $("strategy-desc").textContent = S.STRATEGIES[$("strategy").value].describe;
    $("reward-desc").textContent = S.REWARDS[$("reward").value].describe;
  }

  /* --- Run / stop --------------------------------------------------------- */
  function archetypesForScope() {
    const scope = $("scope").value;
    if (scope === "all") return E.ARCHETYPES.map((a) => a.key);
    return [scope];
  }

  function run() {
    if (running) return;
    const strategyKey = $("strategy").value;
    if (!S.STRATEGIES[strategyKey].implemented) return;

    const archs = archetypesForScope();
    const params = {
      population: clampInt($("population").value, 6, 200, 28),
      generations: clampInt($("generations").value, 1, 500, 35),
    };
    const seedCount = clampInt($("seedCount").value, 4, 100, 20);

    // Reset state + UI.
    store = {};
    $("arch-results").innerHTML = "";
    $("leaderboard-panel").hidden = true;
    $("inspector-panel").hidden = true;
    archs.forEach((a) => { store[a] = { history: [], dist: {}, status: "queued", result: null }; createCard(a); });

    worker = new Worker("playtest/worker.js");
    worker.onmessage = onWorkerMessage;
    worker.onerror = (e) => { setStatus("Worker error: " + e.message); stop(); };
    worker.postMessage({
      type: "run", strategy: strategyKey, reward: $("reward").value,
      archetypes: archs, seedCount: seedCount, params: params,
    });

    running = true;
    $("run-btn").disabled = true;
    $("stop-btn").disabled = false;
    setStatus("Training " + archs.length + " archetype" + (archs.length > 1 ? "s" : "") + " — " +
      S.STRATEGIES[strategyKey].label + "…");
  }

  function stop() {
    if (worker) { worker.terminate(); worker = null; }
    running = false;
    $("run-btn").disabled = false;
    $("stop-btn").disabled = true;
  }

  function onWorkerMessage(e) {
    const m = e.data;
    if (m.type === "error") { setStatus("⚠ " + m.message); stop(); return; }
    const st = store[m.archetypeKey];

    if (m.type === "archetypeStart") {
      if (st) { st.status = "training"; updateCardStatus(m.archetypeKey, "training…"); }
    } else if (m.type === "progress") {
      if (!st) return;
      st.history.push({ gen: m.gen, best: m.best, mean: m.mean });
      st.dist = m.dist;
      st.best = m.best;
      drawCard(m.archetypeKey, "gen " + (m.gen + 1) + "/" + m.generations + " · best " + m.bestOutcome);
    } else if (m.type === "archetypeDone") {
      if (!st) return;
      st.result = m.result;
      st.dist = m.result.dist;
      st.status = "done";
      renderResultCard(m.archetypeKey);
    } else if (m.type === "done") {
      running = false;
      $("run-btn").disabled = false;
      $("stop-btn").disabled = true;
      setStatus("Done. Trained " + Object.keys(m.results).length + " archetype(s).");
      renderLeaderboard();
      setupInspector();
    }
  }

  /* --- Per-archetype card rendering --------------------------------------- */
  function createCard(arch) {
    const card = document.createElement("div");
    card.className = "arch-card-r";
    card.id = "card-" + arch;
    card.innerHTML =
      '<h3>' + ARCH_NAME[arch] + ' <span class="status" id="status-' + arch + '">queued</span></h3>' +
      '<div class="curve-wrap"><canvas id="curve-' + arch + '" width="600" height="180"></canvas>' +
      '<div class="curve-legend"><b style="color:#7ed6a0">— best</b> <b style="color:#6fc3ff">— mean</b></div></div>' +
      '<div id="dist-' + arch + '"></div>' +
      '<div id="body-' + arch + '"></div>';
    $("arch-results").appendChild(card);
    store[arch].el = { card };
  }

  function updateCardStatus(arch, txt) {
    const el = $("status-" + arch);
    if (el) el.textContent = txt;
  }

  function drawCard(arch, statusTxt) {
    updateCardStatus(arch, statusTxt);
    drawCurve(arch);
    drawDist(arch);
  }

  // Live training curve: best (green) and mean (blue) fitness across generations,
  // each auto-scaled to the run's own min/max so the shape is visible regardless
  // of the reward's absolute magnitude.
  function drawCurve(arch) {
    const cv = $("curve-" + arch);
    if (!cv) return;
    const ctx = cv.getContext("2d");
    const W = cv.width, H = cv.height, pad = 6;
    ctx.clearRect(0, 0, W, H);
    const hist = store[arch].history;
    if (hist.length < 1) return;

    let lo = Infinity, hi = -Infinity;
    hist.forEach((h) => {
      lo = Math.min(lo, h.best, h.mean);
      hi = Math.max(hi, h.best, h.mean);
    });
    if (hi === lo) { hi = lo + 1; }
    const n = Math.max(hist.length - 1, 1);
    const x = (i) => pad + (i / n) * (W - 2 * pad);
    const y = (v) => H - pad - ((v - lo) / (hi - lo)) * (H - 2 * pad);

    const line = (key, color) => {
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      hist.forEach((h, i) => {
        const px = x(i), py = y(h[key]);
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      });
      ctx.stroke();
    };
    line("mean", "#6fc3ff");
    line("best", "#7ed6a0");
  }

  // Outcome distribution stacked bar (failed…champion), tier-colored.
  function drawDist(arch) {
    const dist = store[arch].dist || {};
    const total = Object.values(dist).reduce((a, b) => a + b, 0);
    const host = $("dist-" + arch);
    if (!host) return;
    if (!total) { host.innerHTML = ""; return; }
    const order = ["failed", "zombie", "lifestyle", "growth", "acquisition", "champion"];
    let bars = "", legend = "";
    order.forEach((k) => {
      const c = dist[k] || 0;
      if (!c) return;
      const o = E.OUTCOMES[k];
      bars += '<div class="dist-seg" style="width:' + (100 * c / total) + '%;background:' + o.color + '" title="' + o.name + ': ' + c + '"></div>';
      legend += '<span><i class="dist-dot" style="background:' + o.color + '"></i>' + o.name + ' ' + c + '</span>';
    });
    host.innerHTML = '<div class="dist-legend">' + legend + '</div><div class="dist-bars">' + bars + '</div>';
  }

  function renderResultCard(arch) {
    drawCurve(arch);
    drawDist(arch);
    updateCardStatus(arch, "done");
    const r = store[arch].result;
    const pb = r.playbook;
    const o = E.OUTCOMES[pb.summary.outcomeKey];

    // Group playbook steps by phase for readability.
    let phases = [], cur = null;
    pb.steps.forEach((s) => {
      if (!cur || cur.phase !== s.phase) { cur = { phase: s.phase, steps: [] }; phases.push(cur); }
      cur.steps.push(s);
    });
    const pbHtml = phases.map((p) =>
      '<div class="pb-phase"><div class="pb-phase-name">' + p.phase + '</div>' +
      p.steps.map((s) => '<div class="pb-step' + (s.move === "advance" ? " advance" : "") + '">' +
        (s.move === "advance" ? s.label : "• " + s.label) + '</div>').join("") +
      '</div>'
    ).join("");

    const sm = pb.summary;
    const body = $("body-" + arch);
    body.innerHTML =
      '<div class="best-line">Best run → <b style="color:' + o.color + '">' + o.name + '</b></div>' +
      '<div class="playbook"><h4>Optimal playbook</h4>' + pbHtml +
      '<div class="pb-summary">' +
        '<span class="tag" style="color:' + o.color + ';background:' + o.bg + '">' + o.name + '</span> · ' +
        '$' + fmtK(sm.mrr) + ' MRR · $' + fmtK(sm.arr) + ' ARR · ' + sm.customers + ' customers · ' +
        'score ' + sm.score + ' · rep ' + sm.reputation + ' · ' + sm.weeks + 'w' +
      '</div></div>';
  }

  /* --- Leaderboard -------------------------------------------------------- */
  function renderLeaderboard() {
    const rows = Object.keys(store)
      .filter((a) => store[a].result)
      .map((a) => ({ arch: a, r: store[a].result }));
    if (!rows.length) return;
    rows.sort((x, y) => y.r.fitness - x.r.fitness);
    const maxFit = Math.max.apply(null, rows.map((x) => x.r.fitness));
    const minFit = Math.min.apply(null, rows.map((x) => x.r.fitness));
    const span = maxFit - minFit || 1;

    $("leaderboard").innerHTML = rows.map((row, i) => {
      const o = E.OUTCOMES[row.r.playbook.summary.outcomeKey];
      const frac = 0.12 + 0.88 * (row.r.fitness - minFit) / span;
      return '<div class="lb-row">' +
        '<span class="lb-rank">' + (i + 1) + '</span>' +
        '<span class="lb-arch">' + ARCH_NAME[row.arch] + '</span>' +
        '<span class="lb-bar-track"><span class="lb-bar-fill" style="width:' + (100 * frac) + '%;background:' + o.color + '"></span></span>' +
        '<span class="lb-outcome" style="color:' + o.color + '">' + o.name + '</span>' +
        '</div>';
    }).join("");
    $("leaderboard-panel").hidden = false;
  }

  /* --- Move inspector ----------------------------------------------------- */
  let insp = { arch: null, step: 0 };

  function setupInspector() {
    const sel = $("inspector-arch");
    const archs = Object.keys(store).filter((a) => store[a].result && store[a].result.replay);
    if (!archs.length) { $("inspector-panel").hidden = true; return; }
    sel.innerHTML = archs.map((a) => '<option value="' + a + '">' + ARCH_NAME[a] + '</option>').join("");
    insp.arch = archs[0];
    insp.step = 0;
    sel.value = insp.arch;
    $("inspector-panel").hidden = false;
    drawInspector();
  }

  function drawInspector() {
    const r = store[insp.arch] && store[insp.arch].result;
    if (!r || !r.replay) return;
    const replay = r.replay;
    insp.step = Math.max(0, Math.min(insp.step, replay.length - 1));
    const node = replay[insp.step];
    const s = node.state;

    $("insp-step-label").textContent = "step " + (insp.step + 1) + "/" + replay.length +
      " · " + E.PHASES[s.phaseIndex].name;

    $("inspector-state").innerHTML = [
      ["Cash", "$" + fmtK(s.cash)], ["Runway", Math.round(s.time) + "w"],
      ["Reputation", Math.round(s.reputation)], ["Certainty", Math.round(s.certainty)],
      ["Customers", s.customers], ["MRR", "$" + fmtK(s.mrr)],
      ["Pain", s.painSignals], ["MVP", s.mvpBuilt ? "✓" : "—"],
    ].map((p) => '<div class="istat"><div class="l">' + p[0] + '</div><div class="v">' + p[1] + '</div></div>').join("");

    // Monte Carlo value of each legal move from this exact state.
    const reward = S.REWARDS[r.rewardName || "tier"].fn;
    const samples = clampInt($("insp-samples").value, 4, 200, 24);
    const vals = S.mcMoveValues(s, S.randomPolicy, reward, samples, E.makeRng(insp.step * 7919 + 1));
    const lo = Math.min.apply(null, vals.map((v) => v.value));
    const hi = Math.max.apply(null, vals.map((v) => v.value));
    const span = hi - lo || 1;

    $("inspector-moves").innerHTML = vals.map((v) => {
      const chosen = v.move === node.move;
      const frac = 0.04 + 0.96 * (v.value - lo) / span;
      return '<div class="mv-row">' +
        '<span class="mv-name' + (chosen ? " chosen" : "") + '">' + (chosen ? "➤ " : "") + v.label + '</span>' +
        '<span class="mv-track"><span class="mv-fill' + (chosen ? " chosen" : "") + '" style="width:' + (100 * frac) + '%"></span></span>' +
        '<span class="mv-val">' + fmtSci(v.value) + '</span>' +
        '</div>';
    }).join("");
  }

  /* --- Helpers ------------------------------------------------------------ */
  function setStatus(t) { $("run-status").textContent = t; }
  function clampInt(v, lo, hi, dflt) {
    let n = parseInt(v, 10);
    if (isNaN(n)) n = dflt;
    return Math.max(lo, Math.min(hi, n));
  }
  function fmtK(n) {
    n = Math.round(n);
    if (Math.abs(n) >= 1000) {
      const k = n / 1000;
      return (Math.abs(k) >= 100 ? Math.round(k) : Math.round(k * 10) / 10) + "k";
    }
    return String(n);
  }
  function fmtSci(n) {
    if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1) + "M";
    if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(1) + "k";
    return Math.round(n).toString();
  }

  /* --- Wire up ------------------------------------------------------------ */
  populateSelects();
  $("strategy").addEventListener("change", updateDescs);
  $("reward").addEventListener("change", updateDescs);
  $("run-btn").addEventListener("click", run);
  $("stop-btn").addEventListener("click", () => { stop(); setStatus("Stopped."); });
  $("inspector-arch").addEventListener("change", (e) => { insp.arch = e.target.value; insp.step = 0; drawInspector(); });
  $("insp-prev").addEventListener("click", () => { insp.step--; drawInspector(); });
  $("insp-next").addEventListener("click", () => { insp.step++; drawInspector(); });
  $("insp-samples").addEventListener("change", drawInspector);
})();
