"use strict";

// Decision Tree — the model is a stack of axis-aligned "if this feature is below
// that value" rules. Main view: the decision regions those rules carve out, over
// the data. Internal view: the tree itself, each split labeled with its rule and
// information gain.
DSP.register({
  id: "decision-tree",
  name: "Decision Tree",
  phase: "Phase 1 — Foundations",
  status: "ready",
  blurb: "Split the feature space with yes/no rules that most reduce impurity.",
  intuition: "A tree is a sequence of decisions. Each split is chosen greedily to make the resulting groups as pure as possible. Deeper trees fit more — and overfit more.",

  mount(ctx) {
    const { panels, ui, data, Plot, canvas, COLORS, CLASS_COLORS } = ctx;

    const xb = { min: 0, max: 12, ymin: 0, ymax: 12 };
    let points = data.twoClasses(22, { xMin: xb.min, xMax: xb.max, yMin: xb.ymin, yMax: xb.ymax, spread: 1.8 });
    let maxDepth = 3;
    let minSamples = 2;
    let criterion = "gini";
    let addClass = 0;
    let tree = null;

    const mainC = canvas(panels.viz, 480, 480);
    const plot = new Plot(mainC, { xMin: xb.min, xMax: xb.max, yMin: xb.ymin, yMax: xb.ymax });
    ui.note(panels.viz, "Click to add a point of the selected class · drag to move · shift-click to remove.");

    const treeC = canvas(panels.internal, 560, 340);
    const tctx = treeC.getContext("2d");
    ctx.titles.internal.textContent = "Internal — The Tree";
    ui.note(panels.internal, "Internal nodes show the split rule and its information gain. Leaves are colored by the class they predict.");

    function classColor(label, alpha) {
      const hex = CLASS_COLORS[label % CLASS_COLORS.length];
      if (alpha === undefined) return hex;
      const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
      return `rgba(${r},${g},${b},${alpha})`;
    }

    // Tree building lives in the shared CART library (src/lib/cart.js).
    const predict = (node, x, y) => CART.predict(node, x, y);
    const countLeaves = (node) => CART.countLeaves(node);
    const treeDepth = (node) => CART.treeDepth(node);

    const mAcc = ui.metric(panels.metrics, "Train accuracy");
    const mLeaves = ui.metric(panels.metrics, "Leaves");
    const mDepth = ui.metric(panels.metrics, "Actual depth");
    const mGain = ui.metric(panels.metrics, "Root info gain");
    const mImp = ui.metric(panels.metrics, "Root impurity");

    function rebuild() {
      tree = points.length ? CART.buildClassTree(points, points.map((_, i) => i), { maxDepth, minSamples, criterion }) : null;
    }

    function drawRegions(node, x1, y1, x2, y2) {
      if (!node) return;
      if (node.leaf) {
        const conf = node.count ? (node.counts[node.label] || 0) / node.count : 0;
        plot.rect(x1, y1, x2, y2, classColor(node.label, 0.12 + conf * 0.28));
        return;
      }
      if (node.feat === "x") {
        drawRegions(node.left, x1, y1, node.t, y2);
        drawRegions(node.right, node.t, y1, x2, y2);
        plot.line(node.t, y1, node.t, y2, { color: COLORS.gray, width: 1 });
      } else {
        drawRegions(node.left, x1, y1, x2, node.t);
        drawRegions(node.right, x1, node.t, x2, y2);
        plot.line(x1, node.t, x2, node.t, { color: COLORS.gray, width: 1 });
      }
    }

    function drawMain() {
      plot.clear();
      if (tree) drawRegions(tree, xb.min, xb.ymin, xb.max, xb.ymax);
      plot.grid({ xStep: 2, yStep: 2, xLabel: "feature 1", yLabel: "feature 2" });
      for (const p of points) plot.point(p.x, p.y, { r: 5, color: classColor(p.label), stroke: "#0e1014", width: 1.2 });
    }

    function drawTree() {
      tctx.fillStyle = COLORS.panel; tctx.fillRect(0, 0, treeC.width, treeC.height);
      if (!tree) return;
      let leafX = 0;
      (function assign(n) { if (n.leaf) { n.ux = leafX++; return; } assign(n.left); assign(n.right); n.ux = (n.left.ux + n.right.ux) / 2; })(tree);
      const leaves = leafX;
      const depth = treeDepth(tree);
      const padX = 40, padY = 26;
      const px = (ux) => leaves <= 1 ? treeC.width / 2 : padX + (treeC.width - 2 * padX) * (ux / (leaves - 1));
      const py = (d) => padY + (depth <= 0 ? 0 : (treeC.height - 2 * padY) * (d / depth));
      tctx.font = "11px system-ui"; tctx.textAlign = "center"; tctx.textBaseline = "middle";
      // edges
      (function edges(n) {
        if (n.leaf) return;
        for (const child of [n.left, n.right]) {
          tctx.strokeStyle = COLORS.axis; tctx.lineWidth = 1;
          tctx.beginPath(); tctx.moveTo(px(n.ux), py(n.depth)); tctx.lineTo(px(child.ux), py(child.depth)); tctx.stroke();
          edges(child);
        }
      })(tree);
      // nodes
      (function nodes(n) {
        const x = px(n.ux), y = py(n.depth);
        if (n.leaf) {
          tctx.fillStyle = classColor(n.label, 0.9);
          roundRect(x - 26, y - 13, 52, 26, 6); tctx.fill();
          tctx.fillStyle = "#101319"; tctx.fillText(`c${n.label} · ${n.count}`, x, y);
        } else {
          tctx.fillStyle = "#222838"; tctx.strokeStyle = COLORS.train; tctx.lineWidth = 1.2;
          roundRect(x - 42, y - 15, 84, 30, 6); tctx.fill(); tctx.stroke();
          const f = n.feat === "x" ? "f1" : "f2";
          tctx.fillStyle = COLORS.textBright; tctx.fillText(`${f} ≤ ${n.t.toFixed(1)}`, x, y - 5);
          tctx.fillStyle = COLORS.update; tctx.fillText(`gain ${n.gain.toFixed(2)}`, x, y + 7);
          nodes(n.left); nodes(n.right);
        }
      })(tree);
    }
    function roundRect(x, y, w, h, r) {
      tctx.beginPath();
      tctx.moveTo(x + r, y);
      tctx.arcTo(x + w, y, x + w, y + h, r);
      tctx.arcTo(x + w, y + h, x, y + h, r);
      tctx.arcTo(x, y + h, x, y, r);
      tctx.arcTo(x, y, x + w, y, r);
      tctx.closePath();
    }

    function metrics() {
      if (!tree || !points.length) { [mAcc, mLeaves, mDepth, mGain, mImp].forEach((f) => f("–")); return; }
      let correct = 0;
      for (const p of points) if (predict(tree, p.x, p.y) === p.label) correct++;
      mAcc((100 * correct / points.length).toFixed(1) + "%");
      mLeaves(countLeaves(tree));
      mDepth(treeDepth(tree));
      mGain(tree.leaf ? "0" : tree.gain.toFixed(3));
      mImp(tree.impurity.toFixed(3));
    }

    function render() { drawMain(); drawTree(); metrics(); }

    // editing
    ctx.onCleanup(ctx.enablePointEditing(plot, points, {
      onAdd: (x, y) => points.push({ x, y, label: addClass }),
      onChange: () => { rebuild(); render(); },
    }));

    // controls
    const classBtns = ui.buttonRow(panels.data, [
      { label: "Add Class 0", onClick: () => setAddClass(0) },
      { label: "Add Class 1", onClick: () => setAddClass(1) },
    ]);
    function setAddClass(c) { addClass = c; classBtns.forEach((b, i) => b.classList.toggle("active", i === c)); }
    setAddClass(0);
    ui.buttonRow(panels.data, [
      { label: "Randomize", onClick: () => { points = data.twoClasses(22, { xMin: xb.min, xMax: xb.max, yMin: xb.ymin, yMax: xb.ymax, spread: 1.8 }); rebuild(); render(); } },
      { label: "Clear", kind: "danger", onClick: () => { points = []; rebuild(); render(); } },
    ]);

    ui.slider(panels.hyper, { label: "Max depth", min: 1, max: 8, step: 1, value: maxDepth, onInput: (v) => { maxDepth = v; rebuild(); render(); } });
    ui.slider(panels.hyper, { label: "Min samples / leaf", min: 1, max: 10, step: 1, value: minSamples, onInput: (v) => { minSamples = v; rebuild(); render(); } });
    ui.select(panels.hyper, { label: "Split criterion", options: [{ value: "gini", label: "Gini impurity" }, { value: "entropy", label: "Entropy" }], value: criterion, onChange: (v) => { criterion = v; rebuild(); render(); } });
    ui.note(panels.hyper, "Push max depth up and the regions fragment to wrap every point — classic overfitting you can see.");

    rebuild();
    render();
  },
});
