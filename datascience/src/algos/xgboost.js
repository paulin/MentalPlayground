"use strict";

// XGBoost-style boosting — gradient boosting plus an L2 leaf penalty (lambda) and
// a held-out validation set. Main view: train vs validation points + the
// ensemble curve. Internal view: train and validation error vs rounds — the
// classic "train keeps dropping, validation turns back up" overfitting picture.
DSP.register({
  id: "xgboost",
  name: "XGBoost",
  phase: "Phase 2 — Supervised",
  status: "ready",
  blurb: "Regularized boosted trees, tuned against a validation set.",
  intuition: "More rounds always cut training error — but validation error bottoms out and then climbs. Regularization (lambda) and a slower learning rate push that turning point later, trading fit for generalization.",

  mount(ctx) {
    const { panels, ui, data, Plot, canvas, COLORS, CLASS_COLORS } = ctx;

    const xb = { min: 0, max: 12, ymin: -4, ymax: 4 };
    let all = makeData();
    let lr = 0.3, maxDepth = 3, lambda = 1, targetRounds = 12, running = false;
    let F0 = 0, trees = [];
    let trainHist = [], valHist = [], bestRound = 0;

    function makeData() {
      const pts = [];
      for (let i = 0; i < 60; i++) {
        const x = 12 * Math.random();
        pts.push({ x, y: 1.6 * Math.sin(x * 0.8) + data.gauss() * 0.6, val: Math.random() < 0.33 });
      }
      return pts;
    }
    const train = () => all.filter((p) => !p.val);
    const valid = () => all.filter((p) => p.val);

    const mainC = canvas(panels.viz, 560, 360);
    const plot = new Plot(mainC, { xMin: xb.min, xMax: xb.max, yMin: xb.ymin, yMax: xb.ymax });
    ui.note(panels.viz, "Filled = training points, hollow = validation. Click to add a training point · drag · shift-click to remove.");

    const errC = canvas(panels.internal, 560, 300);
    const errPlot = new Plot(errC, { xMin: 0, xMax: 12, yMin: 0, yMax: 1, pad: 38 });
    ctx.titles.internal.textContent = "Internal — Train vs Validation Error";
    ui.note(panels.internal, "Blue = training RMSE, orange = validation RMSE, dashed line = the round with lowest validation error (where you'd stop).");

    function predictUpTo(x, k) { let v = F0; for (let i = 0; i < k && i < trees.length; i++) v += lr * CART.predictReg(trees[i], x); return v; }
    const predictF = (x) => predictUpTo(x, trees.length);
    function rmse(pts, k) { if (!pts.length) return 0; let s = 0; for (const p of pts) s += (p.y - predictUpTo(p.x, k)) ** 2; return Math.sqrt(s / pts.length); }

    function rebuild() {
      const tr = train();
      F0 = tr.length ? tr.reduce((s, p) => s + p.y, 0) / tr.length : 0;
      trees = [];
      for (let round = 0; round < targetRounds; round++) {
        const samples = tr.map((p) => ({ x: p.x, t: p.y - predictF(p.x) }));
        if (!samples.length) break;
        trees.push(CART.buildRegTree(samples, { maxDepth, minSamples: 1, lambda }));
      }
      // error curves over rounds 0..targetRounds
      trainHist = []; valHist = [];
      const vp = valid();
      for (let k = 0; k <= trees.length; k++) { trainHist.push(rmse(tr, k)); valHist.push(rmse(vp, k)); }
      bestRound = 0; let bv = Infinity;
      valHist.forEach((e, k) => { if (vp.length && e < bv) { bv = e; bestRound = k; } });
    }

    const mRounds = ui.metric(panels.metrics, "Rounds");
    const mTrain = ui.metric(panels.metrics, "Train RMSE");
    const mVal = ui.metric(panels.metrics, "Validation RMSE");
    const mBest = ui.metric(panels.metrics, "Best val @ round");
    const mLambda = ui.metric(panels.metrics, "Lambda (L2)");

    function curve(p, fn, color, width) {
      p.ctx.strokeStyle = color; p.ctx.lineWidth = width; p.ctx.beginPath();
      for (let i = 0; i <= 200; i++) { const x = xb.min + (xb.max - xb.min) * i / 200, sx = p.px(x), sy = p.py(fn(x)); i ? p.ctx.lineTo(sx, sy) : p.ctx.moveTo(sx, sy); }
      p.ctx.stroke();
    }

    function drawMain() {
      plot.clear();
      plot.grid({ xStep: 2, yStep: 2, xLabel: "x", yLabel: "y" });
      if (train().length) curve(plot, predictF, COLORS.predict, 2.5);
      for (const p of all) {
        if (p.val) plot.point(p.x, p.y, { r: 4.5, color: COLORS.panel, stroke: CLASS_COLORS[1], width: 2 });
        else plot.point(p.x, p.y, { r: 4.5, color: CLASS_COLORS[0], stroke: "#0e1014", width: 1.2 });
      }
    }

    function drawErr() {
      const maxE = Math.max(0.5, ...trainHist, ...valHist) * 1.1;
      errPlot.setBounds(0, Math.max(1, trees.length), 0, maxE);
      errPlot.clear();
      errPlot.grid({ xStep: Math.max(1, Math.round(trees.length / 6)), yStep: maxE > 2 ? 1 : 0.5, xLabel: "rounds", yLabel: "RMSE" });
      const plotHist = (hist, color) => { errPlot.ctx.strokeStyle = color; errPlot.ctx.lineWidth = 2; errPlot.ctx.beginPath(); hist.forEach((e, k) => { const sx = errPlot.px(k), sy = errPlot.py(e); k ? errPlot.ctx.lineTo(sx, sy) : errPlot.ctx.moveTo(sx, sy); }); errPlot.ctx.stroke(); };
      if (valid().length) plotHist(valHist, CLASS_COLORS[1]);
      plotHist(trainHist, CLASS_COLORS[0]);
      if (valid().length && bestRound >= 0) errPlot.line(bestRound, 0, bestRound, maxE, { color: COLORS.gray, width: 1, dash: [4, 3] });
    }

    function metrics() {
      mRounds(trees.length); mLambda(lambda.toFixed(1));
      const tr = train(), vp = valid();
      mTrain(tr.length ? rmse(tr, trees.length).toFixed(3) : "–");
      mVal(vp.length ? rmse(vp, trees.length).toFixed(3) : "–");
      mBest(vp.length ? bestRound : "–");
    }

    function render() { drawMain(); drawErr(); metrics(); }
    function apply() { rebuild(); render(); }

    let frame = 0, raf = requestAnimationFrame(function loop() {
      if (running) { frame++; if (frame % 16 === 0) { if (targetRounds < 80) { targetRounds++; roundSlider.value = targetRounds; apply(); } else { running = false; runBtn.textContent = "Play rounds"; } } }
      raf = requestAnimationFrame(loop);
    });
    ctx.onCleanup(() => cancelAnimationFrame(raf));

    ctx.onCleanup(ctx.enablePointEditing(plot, all, {
      onAdd: (x, y) => all.push({ x, y, val: false }),
      onChange: apply,
    }));

    ui.buttonRow(panels.data, [
      { label: "New dataset", onClick: () => { all = makeData(); apply(); } },
      { label: "Add noise", onClick: () => { all.forEach((p) => p.y += data.gauss() * 0.5); apply(); } },
    ]);
    ui.buttonRow(panels.data, [{ label: "Clear", kind: "danger", onClick: () => { all = []; apply(); } }]);

    const roundSlider = ui.slider(panels.hyper, { label: "Boosting rounds", min: 0, max: 80, step: 1, value: targetRounds, onInput: (v) => { targetRounds = v; apply(); } });
    ui.slider(panels.hyper, { label: "Learning rate", min: 0.05, max: 1, step: 0.05, value: lr, format: (v) => v.toFixed(2), onInput: (v) => { lr = v; apply(); } });
    ui.slider(panels.hyper, { label: "Tree depth", min: 1, max: 6, step: 1, value: maxDepth, onInput: (v) => { maxDepth = v; apply(); } });
    ui.slider(panels.hyper, { label: "Lambda (L2 regularization)", min: 0, max: 20, step: 0.5, value: lambda, format: (v) => v.toFixed(1), onInput: (v) => { lambda = v; apply(); } });
    var [runBtn] = ui.buttonRow(panels.hyper, [
      { label: "Play rounds", kind: "primary", onClick: () => { running = !running; runBtn.textContent = running ? "Pause" : "Play rounds"; } },
      { label: "Step +1", onClick: () => { running = false; runBtn.textContent = "Play rounds"; if (targetRounds < 80) { targetRounds++; roundSlider.value = targetRounds; apply(); } } },
    ]);
    ui.note(panels.hyper, "Push depth up and lambda to 0, then add rounds: validation error (orange) bottoms out and climbs while training error keeps falling. Raise lambda to flatten the overfit.");

    apply();
  },
});
