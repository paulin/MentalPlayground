"use strict";

// Gradient Boosting (1D regression) — start from the mean, then add small trees
// that each fit the leftover residuals. Main view: the data and the ensemble
// curve sharpening round by round. Internal view: the residuals the next tree
// must fix, with the most recent tree's step contribution overlaid.
DSP.register({
  id: "gradient-boosting",
  name: "Gradient Boosting",
  phase: "Phase 2 — Supervised",
  status: "ready",
  blurb: "Add weak trees that each correct the previous ensemble's errors.",
  intuition: "Each new tree is trained on what's still wrong — the residuals. Shrink each tree's contribution by the learning rate and you trade more rounds for better generalization.",

  mount(ctx) {
    const { panels, ui, data, Plot, canvas, COLORS } = ctx;

    const xb = { min: 0, max: 12, ymin: -4, ymax: 4 };
    let points = sinePreset();
    let lr = 0.3, maxDepth = 3, targetRounds = 0, running = false;
    let F0 = 0, trees = [];

    function sinePreset() { const p = []; for (let i = 0; i < 40; i++) { const x = 12 * i / 39; p.push({ x, y: 2 * Math.sin(x * 0.9) + data.gauss() * 0.35 }); } return p; }
    function stepPreset() { const p = []; for (let i = 0; i < 40; i++) { const x = 12 * Math.random(); p.push({ x, y: (x < 6 ? -1.5 : 1.5) + data.gauss() * 0.3 }); } return p; }
    function linePreset() { const p = []; for (let i = 0; i < 35; i++) { const x = 12 * Math.random(); p.push({ x, y: 0.45 * x - 2.5 + data.gauss() * 0.5 }); } return p; }

    const mainC = canvas(panels.viz, 560, 380);
    const plot = new Plot(mainC, { xMin: xb.min, xMax: xb.max, yMin: xb.ymin, yMax: xb.ymax });
    ui.note(panels.viz, "Drag points to reshape the target · click to add · shift-click to remove. Green curve = current ensemble.");

    const resC = canvas(panels.internal, 560, 280);
    const resPlot = new Plot(resC, { xMin: xb.min, xMax: xb.max, yMin: -3, yMax: 3 });
    ctx.titles.internal.textContent = "Internal — Residuals & the Newest Tree";
    ui.note(panels.internal, "Red stems are what the ensemble still gets wrong. The purple step function is the latest tree, fitted to exactly those residuals.");

    function predictUpTo(x, k) { let v = F0; for (let i = 0; i < k && i < trees.length; i++) v += lr * CART.predictReg(trees[i], x); return v; }
    const predictF = (x) => predictUpTo(x, trees.length);

    function rebuild() {
      F0 = points.length ? points.reduce((s, p) => s + p.y, 0) / points.length : 0;
      trees = [];
      for (let round = 0; round < targetRounds; round++) {
        const samples = points.map((p) => ({ x: p.x, t: p.y - predictF(p.x) }));
        if (!samples.length) break;
        trees.push(CART.buildRegTree(samples, { maxDepth, minSamples: 1, lambda: 0 }));
      }
    }

    const mRounds = ui.metric(panels.metrics, "Rounds (trees)");
    const mRmse = ui.metric(panels.metrics, "Train RMSE");
    const mLr = ui.metric(panels.metrics, "Learning rate");
    const mLeaves = ui.metric(panels.metrics, "Leaves / tree");

    function curve(p, fn, color, width) {
      p.ctx.strokeStyle = color; p.ctx.lineWidth = width; p.ctx.beginPath();
      for (let i = 0; i <= 200; i++) { const x = xb.min + (xb.max - xb.min) * i / 200, sx = p.px(x), sy = p.py(fn(x)); i ? p.ctx.lineTo(sx, sy) : p.ctx.moveTo(sx, sy); }
      p.ctx.stroke();
    }

    function drawMain() {
      plot.clear();
      plot.grid({ xStep: 2, yStep: 2, xLabel: "x", yLabel: "y" });
      if (points.length) {
        plot.line(xb.min, F0, xb.max, F0, { color: COLORS.gray, width: 1, dash: [4, 4] }); // F0 baseline
        curve(plot, predictF, COLORS.predict, 2.5);
      }
      for (const p of points) plot.point(p.x, p.y, { r: 4.5, color: COLORS.train, stroke: "#0e1014", width: 1.2 });
    }

    function drawResiduals() {
      // residuals after the current ensemble (what the next tree would fit)
      const res = points.map((p) => ({ x: p.x, r: p.y - predictF(p.x) }));
      const maxAbs = Math.max(1, ...res.map((d) => Math.abs(d.r)));
      resPlot.setBounds(xb.min, xb.max, -maxAbs * 1.1, maxAbs * 1.1);
      resPlot.clear();
      resPlot.grid({ xStep: 2, yStep: maxAbs > 2 ? 1 : 0.5, xLabel: "x", yLabel: "residual" });
      resPlot.line(xb.min, 0, xb.max, 0, { color: COLORS.axis, width: 1 });
      for (const d of res) { resPlot.line(d.x, 0, d.x, d.r, { color: COLORS.error, width: 1 }); resPlot.point(d.x, d.r, { r: 3, color: COLORS.error }); }
      // the most recently added tree's (unshrunk) prediction
      if (trees.length) curve(resPlot, (x) => CART.predictReg(trees[trees.length - 1], x), COLORS.update, 2);
    }

    function metrics() {
      mRounds(trees.length); mLr(lr.toFixed(2));
      if (!points.length) { mRmse("–"); mLeaves("–"); return; }
      let sse = 0; for (const p of points) sse += (p.y - predictF(p.x)) ** 2;
      mRmse(Math.sqrt(sse / points.length).toFixed(3));
      mLeaves(trees.length ? (trees.reduce((s, t) => s + CART.countLeaves(t), 0) / trees.length).toFixed(1) : "–");
    }

    function render() { drawMain(); drawResiduals(); metrics(); }
    function apply() { rebuild(); render(); }

    let frame = 0, raf = requestAnimationFrame(function loop() {
      if (running) { frame++; if (frame % 18 === 0) { if (targetRounds < 60) { targetRounds++; roundSlider.value = targetRounds; apply(); } else { running = false; runBtn.textContent = "Play rounds"; } } }
      raf = requestAnimationFrame(loop);
    });
    ctx.onCleanup(() => cancelAnimationFrame(raf));

    ctx.onCleanup(ctx.enablePointEditing(plot, points, {
      onAdd: (x, y) => points.push({ x, y }),
      onChange: apply,
    }));

    ui.buttonRow(panels.data, [
      { label: "Sine", onClick: () => { points = sinePreset(); apply(); } },
      { label: "Step", onClick: () => { points = stepPreset(); apply(); } },
      { label: "Linear", onClick: () => { points = linePreset(); apply(); } },
    ]);
    ui.buttonRow(panels.data, [{ label: "Clear", kind: "danger", onClick: () => { points = []; apply(); } }]);

    const roundSlider = ui.slider(panels.hyper, { label: "Boosting rounds", min: 0, max: 60, step: 1, value: targetRounds, onInput: (v) => { targetRounds = v; apply(); } });
    ui.slider(panels.hyper, { label: "Learning rate", min: 0.05, max: 1, step: 0.05, value: lr, format: (v) => v.toFixed(2), onInput: (v) => { lr = v; apply(); } });
    ui.slider(panels.hyper, { label: "Tree depth", min: 1, max: 5, step: 1, value: maxDepth, onInput: (v) => { maxDepth = v; apply(); } });
    var [runBtn] = ui.buttonRow(panels.hyper, [
      { label: "Play rounds", kind: "primary", onClick: () => { running = !running; runBtn.textContent = running ? "Pause" : "Play rounds"; } },
      { label: "Step +1", onClick: () => { running = false; runBtn.textContent = "Play rounds"; if (targetRounds < 60) { targetRounds++; roundSlider.value = targetRounds; apply(); } } },
    ]);
    ui.note(panels.hyper, "Low learning rate + many rounds = a smooth fit. High learning rate = the curve lurches and can overfit the noise. Watch the residual stems shrink.");

    apply();
  },
});
