"use strict";

// Random Forest — many decision trees, each grown on a bootstrap sample with a
// random subset of features, then majority vote. Main view: the smooth ensemble
// boundary (shaded by vote share). Internal view: the blocky, disagreeing
// boundaries of the individual trees that average into it.
DSP.register({
  id: "random-forest",
  name: "Random Forest",
  phase: "Phase 2 — Supervised",
  status: "ready",
  blurb: "Average many decorrelated trees to cut variance.",
  intuition: "Each tree is overfit and jagged in its own way. Bootstrapping rows and sampling features decorrelates them, so their mistakes cancel and the vote is far steadier than any single tree.",

  mount(ctx) {
    const { panels, ui, data, Plot, canvas, COLORS, CLASS_COLORS } = ctx;

    const xb = { min: 0, max: 12, ymin: 0, ymax: 12 };
    let points = data.twoClasses(26, { xMin: xb.min, xMax: xb.max, yMin: xb.ymin, yMax: xb.ymax, spread: 2.0 });
    let nTrees = 25, maxDepth = 6, bagging = true, addClass = 0;
    let forest = [];
    let regionCache = null;

    const mainC = canvas(panels.viz, 460, 460);
    const plot = new Plot(mainC, { xMin: xb.min, xMax: xb.max, yMin: xb.ymin, yMax: xb.ymax });
    ui.note(panels.viz, "Click to add a point of the selected class · drag to move · shift-click to remove. Shading = share of trees voting class 1.");

    const treesC = canvas(panels.internal, 560, 340);
    const tctx = treesC.getContext("2d");
    ctx.titles.internal.textContent = "Internal — Individual Trees (first 12)";
    ui.note(panels.internal, "Each tile is one tree's decision regions. Notice how different and over-confident they are alone — the ensemble is their average.");

    function bootstrap() {
      const idx = [];
      const n = points.length;
      for (let i = 0; i < n; i++) idx.push(Math.floor(Math.random() * n));
      return idx;
    }
    function train() {
      forest = [];
      if (points.length < 2) { regionCache = null; return; }
      for (let t = 0; t < nTrees; t++) {
        forest.push(CART.buildClassTree(points, bootstrap(), { maxDepth, minSamples: 1, featureBag: bagging ? 1 : 2 }));
      }
      regionCache = null;
    }
    function voteShare(x, y) {
      if (!forest.length) return 0.5;
      let one = 0;
      for (const tree of forest) one += CART.predict(tree, x, y);
      return one / forest.length;
    }

    function blend(p) {
      const A = CLASS_COLORS[0], B = CLASS_COLORS[1];
      const ha = [parseInt(A.slice(1, 3), 16), parseInt(A.slice(3, 5), 16), parseInt(A.slice(5, 7), 16)];
      const hb = [parseInt(B.slice(1, 3), 16), parseInt(B.slice(3, 5), 16), parseInt(B.slice(5, 7), 16)];
      return [0, 1, 2].map((i) => Math.round(ha[i] * (1 - p) + hb[i] * p));
    }
    function buildRegions() {
      const w = mainC.width, h = mainC.height, cell = 10;
      const img = plot.ctx.createImageData(w, h);
      for (let py = 0; py < h; py += cell)
        for (let px = 0; px < w; px += cell) {
          const p = voteShare(plot.dx(px + cell / 2), plot.dy(py + cell / 2));
          const [r, g, b] = blend(p);
          for (let yy = py; yy < Math.min(py + cell, h); yy++)
            for (let xx = px; xx < Math.min(px + cell, w); xx++) {
              const o = (yy * w + xx) * 4; img.data[o] = r; img.data[o + 1] = g; img.data[o + 2] = b; img.data[o + 3] = 55;
            }
        }
      regionCache = img;
    }

    const mAcc = ui.metric(panels.metrics, "Train accuracy");
    const mTrees = ui.metric(panels.metrics, "Trees");
    const mDepth = ui.metric(panels.metrics, "Avg leaves / tree");
    const mBag = ui.metric(panels.metrics, "Feature bagging");

    function drawMain() {
      plot.clear();
      if (forest.length) { if (!regionCache) buildRegions(); plot.ctx.putImageData(regionCache, 0, 0); }
      plot.grid({ xStep: 2, yStep: 2, xLabel: "feature 1", yLabel: "feature 2" });
      for (const p of points) plot.point(p.x, p.y, { r: 5, color: CLASS_COLORS[p.label], stroke: "#0e1014", width: 1.3 });
    }

    // Fill one tree's regions into an arbitrary pixel rectangle (for thumbnails).
    function drawTreeToRect(node, rx, ry, rw, rh, dx1, dy1, dx2, dy2) {
      if (node.leaf) {
        const hex = CLASS_COLORS[node.label % CLASS_COLORS.length];
        tctx.fillStyle = hex;
        const sx = rx + rw * (dx1 - xb.min) / (xb.max - xb.min);
        const ex = rx + rw * (dx2 - xb.min) / (xb.max - xb.min);
        const sy = ry + rh * (1 - (dy2 - xb.ymin) / (xb.ymax - xb.ymin));
        const ey = ry + rh * (1 - (dy1 - xb.ymin) / (xb.ymax - xb.ymin));
        tctx.fillRect(sx, sy, ex - sx, ey - sy);
        return;
      }
      if (node.feat === "x") {
        drawTreeToRect(node.left, rx, ry, rw, rh, dx1, dy1, node.t, dy2);
        drawTreeToRect(node.right, rx, ry, rw, rh, node.t, dy1, dx2, dy2);
      } else {
        drawTreeToRect(node.left, rx, ry, rw, rh, dx1, dy1, dx2, node.t);
        drawTreeToRect(node.right, rx, ry, rw, rh, dx1, node.t, dx2, dy2);
      }
    }
    function drawTrees() {
      tctx.fillStyle = COLORS.panel; tctx.fillRect(0, 0, treesC.width, treesC.height);
      const cols = 4, rows = 3, n = Math.min(12, forest.length);
      const gap = 8, tw = (treesC.width - gap * (cols + 1)) / cols, th = (treesC.height - gap * (rows + 1)) / rows;
      for (let i = 0; i < n; i++) {
        const r = Math.floor(i / cols), c = i % cols;
        const rx = gap + c * (tw + gap), ry = gap + r * (th + gap);
        drawTreeToRect(forest[i], rx, ry, tw, th, xb.min, xb.ymin, xb.max, xb.ymax);
        tctx.strokeStyle = COLORS.axis; tctx.lineWidth = 1; tctx.strokeRect(rx, ry, tw, th);
        // overlay this tree's bootstrap-sampled points faintly? keep it clean — just the regions.
      }
      if (!forest.length) { tctx.fillStyle = COLORS.gray; tctx.font = "12px system-ui"; tctx.textAlign = "center"; tctx.fillText("add points to grow the forest", treesC.width / 2, treesC.height / 2); }
    }

    function metrics() {
      if (!forest.length) { [mAcc, mDepth].forEach((f) => f("–")); mTrees(nTrees); mBag(bagging ? "1 of 2 feats" : "off"); return; }
      let correct = 0;
      for (const p of points) if ((voteShare(p.x, p.y) >= 0.5 ? 1 : 0) === p.label) correct++;
      const avgLeaves = forest.reduce((s, t) => s + CART.countLeaves(t), 0) / forest.length;
      mAcc((100 * correct / points.length).toFixed(1) + "%");
      mTrees(forest.length);
      mDepth(avgLeaves.toFixed(1));
      mBag(bagging ? "1 of 2 feats" : "off");
    }

    function render() { drawMain(); drawTrees(); metrics(); }
    function retrain() { train(); render(); }

    ctx.onCleanup(ctx.enablePointEditing(plot, points, {
      onAdd: (x, y) => points.push({ x, y, label: addClass }),
      onChange: retrain,
    }));

    const classBtns = ui.buttonRow(panels.data, [
      { label: "Add Class 0", onClick: () => setAdd(0) },
      { label: "Add Class 1", onClick: () => setAdd(1) },
    ]);
    function setAdd(c) { addClass = c; classBtns.forEach((b, i) => b.classList.toggle("active", i === c)); }
    setAdd(0);
    ui.buttonRow(panels.data, [
      { label: "Randomize", onClick: () => { points = data.twoClasses(26, { xMin: xb.min, xMax: xb.max, yMin: xb.ymin, yMax: xb.ymax, spread: 2.0 }); retrain(); } },
      { label: "Clear", kind: "danger", onClick: () => { points = []; retrain(); } },
    ]);

    ui.slider(panels.hyper, { label: "Number of trees", min: 1, max: 80, step: 1, value: nTrees, onInput: (v) => { nTrees = v; retrain(); } });
    ui.slider(panels.hyper, { label: "Max depth", min: 1, max: 10, step: 1, value: maxDepth, onInput: (v) => { maxDepth = v; retrain(); } });
    ui.toggle(panels.hyper, { label: "Feature bagging (random subspace)", value: true, onChange: (v) => { bagging = v; retrain(); } });
    ui.buttonRow(panels.hyper, [{ label: "Re-roll forest", onClick: retrain }]);
    ui.note(panels.hyper, "Drag the tree count from 1 up to 80: a single deep tree's boundary is jagged and over-confident; the ensemble's is smooth and calibrated.");

    train();
    render();
  },
});
