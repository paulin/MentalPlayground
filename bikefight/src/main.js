"use strict";

(function () {
  const sim = new Simulation(CONFIG);
  const arenaCanvas = document.getElementById("arena");
  const renderer = new Renderer(arenaCanvas, CONFIG);
  const brainCanvas = document.getElementById("brain");
  const brainRenderer = new BrainRenderer(brainCanvas, ACTIONS.map((a) => a.name));
  const chartCanvas = document.getElementById("chart");
  const chartCtx = chartCanvas.getContext("2d");

  let agent = null;
  let mode = "idle"; // "idle" | "train" | "eval"
  let speed = 1;

  // Most recent decision + training internals, for the "Inside the Brain" tab
  const brainState = {
    obs: null,
    chosenAction: 0,
    wasExplore: false,
    losses: [], // recent training losses
  };

  // Training stats
  const stats = {
    episodes: 0,
    results: [], // 1 win, 0 loss/draw — last 200
    rewards: [], // per-episode total reward — last 200
    hitsDealt: 0,
    hitsTaken: 0,
    wins: 0, // all-time blue wins / losses / draws
    losses: 0,
    draws: 0,
  };

  // Per-episode accumulators
  let epReward = 0;

  // Best brain tracking
  let bestWeights = null;
  let bestWinRate = -1;
  let bestModel = null;

  // Eval mode tracking
  let evalGames = 0;
  let evalWins = 0;

  const $ = (id) => document.getElementById(id);
  const statusEl = $("status");

  function setStatus(text) {
    statusEl.textContent = text;
  }

  function newAgent() {
    if (agent) agent.dispose();
    agent = new DQNAgent(CONFIG, OBS_SIZE, ACTIONS.length);
  }

  function resetStats() {
    stats.episodes = 0;
    stats.results = [];
    stats.rewards = [];
    stats.hitsDealt = 0;
    stats.hitsTaken = 0;
    stats.wins = 0;
    stats.losses = 0;
    stats.draws = 0;
    epReward = 0;
    if (bestWeights) bestWeights.forEach((w) => w.dispose());
    bestWeights = null;
    bestWinRate = -1;
    if (bestModel) {
      bestModel.dispose();
      bestModel = null;
    }
    evalGames = 0;
    evalWins = 0;
  }

  function winRate(window) {
    const recent = stats.results.slice(-window);
    if (recent.length === 0) return null;
    return recent.reduce((a, b) => a + b, 0) / recent.length;
  }

  async function stepOnce() {
    if (sim.needsReset) {
      sim.reset();
      epReward = 0;
    }

    const obs = sim.getObservation(0);
    let actionIdx;
    let wasExplore = false;
    if (mode === "eval") {
      const model = bestModel || agent.model;
      actionIdx = agent.greedyAction(model, obs);
    } else if (Math.random() < agent.epsilon) {
      // Explore: random action (recorded so the brain tab can show it)
      actionIdx = (Math.random() * ACTIONS.length) | 0;
      wasExplore = true;
    } else {
      actionIdx = agent.greedyAction(agent.model, obs);
    }
    brainState.obs = obs;
    brainState.chosenAction = actionIdx;
    brainState.wasExplore = wasExplore;

    const learnerControls = ACTIONS[actionIdx];
    const botControls = scriptedBotControls(sim, 1);
    const result = sim.step(learnerControls, botControls);
    const reward = sim.computeReward(0, result);
    const nextObs = sim.getObservation(0);

    epReward += reward;
    stats.hitsDealt += result.events[0].hitsDealt;
    stats.hitsTaken += result.events[0].hitsTaken;

    if (mode === "train") {
      agent.remember(obs, actionIdx, reward, nextObs, result.done);
      agent.envSteps++;
      agent.decayEpsilon();
      if (agent.envSteps % CONFIG.dqn.trainEvery === 0) {
        const loss = await agent.train();
        if (loss != null) {
          brainState.losses.push(loss);
          if (brainState.losses.length > 500) brainState.losses.shift();
        }
      }
    }

    if (result.done) finishEpisode(result);
  }

  function finishEpisode(result) {
    if (mode === "eval") {
      evalGames++;
      if (result.winner === 0) evalWins++;
      setStatus(`Running best brain — ${evalWins}/${evalGames} wins`);
      return;
    }

    stats.episodes++;
    if (result.winner === 0) stats.wins++;
    else if (result.winner === 1) stats.losses++;
    else stats.draws++;
    stats.results.push(result.winner === 0 ? 1 : 0);
    stats.rewards.push(epReward);
    if (stats.results.length > 200) stats.results.shift();
    if (stats.rewards.length > 200) stats.rewards.shift();

    // Snapshot the best brain once the rolling window is full
    if (stats.results.length >= CONFIG.bestWindow) {
      const wr = winRate(CONFIG.bestWindow);
      if (wr > bestWinRate) {
        bestWinRate = wr;
        if (bestWeights) bestWeights.forEach((w) => w.dispose());
        bestWeights = agent.snapshotWeights();
      }
    }
    drawChart();
  }

  function updateStatsUI() {
    $("stat-episodes").textContent = stats.episodes;
    const wr = winRate(100);
    $("stat-winrate").textContent = wr === null ? "–" : (wr * 100).toFixed(1) + "%";
    const recent = stats.rewards.slice(-100);
    $("stat-avgreward").textContent =
      recent.length === 0
        ? "–"
        : (recent.reduce((a, b) => a + b, 0) / recent.length).toFixed(1);
    $("stat-epsilon").textContent = agent ? agent.epsilon.toFixed(3) : "–";
    $("stat-hitsdealt").textContent = stats.hitsDealt;
    $("stat-hitstaken").textContent = stats.hitsTaken;
    $("stat-record").textContent = `${stats.wins}–${stats.losses}–${stats.draws}`;
    $("stat-best").textContent =
      bestWinRate < 0 ? "–" : (bestWinRate * 100).toFixed(1) + "%";
  }

  function drawChart() {
    const w = chartCanvas.width;
    const h = chartCanvas.height;
    chartCtx.fillStyle = "#14161c";
    chartCtx.fillRect(0, 0, w, h);
    const data = stats.rewards;
    if (data.length < 2) return;

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const x = (i) => (i / (data.length - 1)) * (w - 8) + 4;
    const y = (v) => h - 6 - ((v - min) / range) * (h - 12);

    // Zero line
    if (min < 0 && max > 0) {
      chartCtx.strokeStyle = "#2e3342";
      chartCtx.beginPath();
      chartCtx.moveTo(0, y(0));
      chartCtx.lineTo(w, y(0));
      chartCtx.stroke();
    }

    chartCtx.strokeStyle = "#4ea3f0";
    chartCtx.lineWidth = 1;
    chartCtx.beginPath();
    data.forEach((v, i) => (i === 0 ? chartCtx.moveTo(x(i), y(v)) : chartCtx.lineTo(x(i), y(v))));
    chartCtx.stroke();

    // 20-episode moving average
    if (data.length >= 20) {
      chartCtx.strokeStyle = "#ffb347";
      chartCtx.lineWidth = 2;
      chartCtx.beginPath();
      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        sum += data[i];
        if (i >= 20) sum -= data[i - 20];
        if (i >= 19) {
          const avg = sum / 20;
          if (i === 19) chartCtx.moveTo(x(i), y(avg));
          else chartCtx.lineTo(x(i), y(avg));
        }
      }
      chartCtx.stroke();
    }
  }

  function drawBrain() {
    if (!agent || !brainState.obs) {
      brainRenderer.draw(null);
      return;
    }
    const acts = agent.getActivations(brainState.obs); // [hidden1, hidden2, q]
    const q = acts[acts.length - 1];
    const hidden = acts.slice(0, acts.length - 1);
    let greedy = 0;
    for (let i = 1; i < q.length; i++) if (q[i] > q[greedy]) greedy = i;
    brainRenderer.draw({
      obs: brainState.obs,
      q,
      activations: hidden,
      chosenAction: brainState.chosenAction,
      greedyAction: greedy,
      wasExplore: brainState.wasExplore,
      epsilon: agent.epsilon,
      epsilonMin: CONFIG.dqn.epsilonMin,
      envSteps: agent.envSteps,
      trainSteps: agent.trainSteps,
      bufferSize: agent.buffer.size,
      bufferCap: CONFIG.dqn.bufferSize,
      losses: brainState.losses,
    });
  }

  // ---- Main loop ----
  let frameBusy = false;
  async function frame() {
    if (!frameBusy) {
      frameBusy = true;
      try {
        if (mode === "train" || mode === "eval") {
          for (let i = 0; i < speed; i++) {
            await stepOnce();
          }
        }
        renderer.draw(sim);
        drawBrain();
        updateStatsUI();
      } finally {
        frameBusy = false;
      }
    }
    requestAnimationFrame(frame);
  }

  // ---- UI wiring ----
  $("btn-train").addEventListener("click", () => {
    if (mode === "eval") sim.needsReset = true;
    mode = "train";
    setStatus("Training…");
  });

  $("btn-pause").addEventListener("click", () => {
    mode = "idle";
    setStatus("Paused");
  });

  $("btn-best").addEventListener("click", () => {
    if (bestModel) {
      bestModel.dispose();
      bestModel = null;
    }
    if (bestWeights) {
      bestModel = agent.buildModel();
      bestModel.setWeights(bestWeights.map((w) => w.clone()));
    }
    evalGames = 0;
    evalWins = 0;
    sim.needsReset = true;
    mode = "eval";
    setStatus(bestWeights ? "Running best brain (greedy)" : "Running current brain (greedy) — no best snapshot yet");
  });

  $("btn-reset").addEventListener("click", () => {
    mode = "idle";
    newAgent();
    resetStats();
    sim.reset();
    drawChart();
    setStatus("Brain reset");
  });

  // Hover the brain canvas for plain-language explanations of each part
  const tooltip = $("brain-tooltip");
  brainCanvas.addEventListener("mousemove", (e) => {
    const rect = brainCanvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (brainCanvas.width / rect.width);
    const y = (e.clientY - rect.top) * (brainCanvas.height / rect.height);
    const region = brainRenderer.hitTest(x, y);
    if (!region) {
      tooltip.hidden = true;
      return;
    }
    tooltip.innerHTML = `<span class="tt-title"></span><span class="tt-body"></span>`;
    tooltip.querySelector(".tt-title").textContent = region.title;
    tooltip.querySelector(".tt-body").textContent = region.body;
    tooltip.hidden = false;
    // Position near the cursor, flipping left/up near the viewport edges
    const pad = 14;
    let left = e.clientX + pad;
    let top = e.clientY + pad;
    const tw = tooltip.offsetWidth;
    const th = tooltip.offsetHeight;
    if (left + tw > window.innerWidth - 8) left = e.clientX - tw - pad;
    if (top + th > window.innerHeight - 8) top = e.clientY - th - pad;
    tooltip.style.left = left + "px";
    tooltip.style.top = top + "px";
  });
  brainCanvas.addEventListener("mouseleave", () => {
    tooltip.hidden = true;
  });

  // Click the arena to drop an obstacle (mapping CSS pixels -> canvas pixels)
  arenaCanvas.addEventListener("click", (e) => {
    const rect = arenaCanvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (arenaCanvas.width / rect.width);
    const y = (e.clientY - rect.top) * (arenaCanvas.height / rect.height);
    sim.addObstacle(x, y);
    renderer.draw(sim);
  });

  $("btn-clear-obstacles").addEventListener("click", () => {
    sim.clearObstacles();
    renderer.draw(sim);
  });

  document.querySelectorAll("#speed-buttons .speed").forEach((btn) => {
    btn.addEventListener("click", () => {
      speed = parseInt(btn.dataset.speed, 10);
      document
        .querySelectorAll("#speed-buttons .speed")
        .forEach((b) => b.classList.toggle("active", b === btn));
    });
  });

  $("btn-export").addEventListener("click", async () => {
    await agent.model.save("downloads://bikefight-dqn");
    setStatus("Brain exported (check downloads)");
  });

  $("btn-import").addEventListener("click", () => $("import-files").click());

  $("import-files").addEventListener("change", async (e) => {
    const files = Array.from(e.target.files);
    const json = files.find((f) => f.name.endsWith(".json"));
    const bins = files.filter((f) => f.name.endsWith(".bin"));
    if (!json || bins.length === 0) {
      setStatus("Import needs the model .json and .bin files");
      return;
    }
    try {
      const loaded = await tf.loadLayersModel(tf.io.browserFiles([json, ...bins]));
      loaded.compile({
        optimizer: tf.train.adam(CONFIG.dqn.learningRate),
        loss: "meanSquaredError",
      });
      agent.model.dispose();
      agent.model = loaded;
      agent.updateTarget();
      setStatus("Brain imported");
    } catch (err) {
      setStatus("Import failed: " + err.message);
    }
    e.target.value = "";
  });

  // ---- Boot ----
  (async () => {
    await tf.ready();
    newAgent();
    sim.reset();
    renderer.draw(sim);
    updateStatsUI();
    setStatus("Ready — press Start Training");
    requestAnimationFrame(frame);
  })();
})();
