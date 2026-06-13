"use strict";

// Shared CART (Classification And Regression Trees) used by the Decision Tree,
// Random Forest, Gradient Boosting and XGBoost screens. Two builders:
//   buildClassTree — 2D (x,y) classification, with optional per-split feature
//                    bagging for random forests.
//   buildRegTree   — 1D regression over samples [{x, t}], with an L2 leaf
//                    regularizer (lambda) for the XGBoost-style screen.
// Tree node shapes are deliberately stable so the screens can draw them directly.

const CART = (function () {
  // ---- classification ----
  function impurity(counts, total, criterion) {
    if (!total) return 0;
    if (criterion === "entropy") {
      let s = 0; for (const k in counts) { const p = counts[k] / total; if (p > 0) s -= p * Math.log2(p); } return s;
    }
    let s = 1; for (const k in counts) { const p = counts[k] / total; s -= p * p; } return s; // gini
  }
  function tally(points, idx) { const c = {}; for (const i of idx) c[points[i].label] = (c[points[i].label] || 0) + 1; return c; }
  function majority(counts) { let best = 0, bv = -1; for (const k in counts) if (counts[k] > bv) { bv = counts[k]; best = Number(k); } return best; }

  function buildClassTree(points, indices, opts) {
    const maxDepth = opts.maxDepth, minSamples = opts.minSamples || 1, criterion = opts.criterion || "gini";
    const featureBag = opts.featureBag || 2; // how many of the 2 features to consider per split
    function build(idx, depth) {
      const counts = tally(points, idx), total = idx.length, imp = impurity(counts, total, criterion);
      const node = { leaf: true, label: majority(counts), count: total, counts, impurity: imp, depth };
      if (depth >= maxDepth || total < minSamples * 2 || imp === 0) return node;
      // choose which features to try this split (random subspace when bagging)
      let feats = ["x", "y"];
      if (featureBag < 2) feats = [Math.random() < 0.5 ? "x" : "y"];
      let best = null;
      for (const feat of feats) {
        const sorted = [...idx].sort((a, b) => points[a][feat] - points[b][feat]);
        for (let s = 0; s < sorted.length - 1; s++) {
          const a = points[sorted[s]][feat], bn = points[sorted[s + 1]][feat];
          if (a === bn) continue;
          const t = (a + bn) / 2;
          const left = idx.filter((i) => points[i][feat] <= t), right = idx.filter((i) => points[i][feat] > t);
          if (left.length < minSamples || right.length < minSamples) continue;
          const gain = imp - (left.length / total) * impurity(tally(points, left), left.length, criterion)
            - (right.length / total) * impurity(tally(points, right), right.length, criterion);
          if (!best || gain > best.gain) best = { feat, t, gain, left, right };
        }
      }
      if (!best || best.gain <= 1e-9) return node;
      return { leaf: false, feat: best.feat, t: best.t, gain: best.gain, impurity: imp, count: total, depth, left: build(best.left, depth + 1), right: build(best.right, depth + 1) };
    }
    return build(indices, 0);
  }

  function predict(node, x, y) {
    while (!node.leaf) node = (node.feat === "x" ? x : y) <= node.t ? node.left : node.right;
    return node.label;
  }

  // ---- 1D regression ----
  function sse(vals) {
    if (!vals.length) return 0;
    const m = vals.reduce((a, b) => a + b, 0) / vals.length;
    return vals.reduce((a, v) => a + (v - m) ** 2, 0);
  }
  // samples: [{x, t}], opts: {maxDepth, minSamples, lambda}
  function buildRegTree(samples, opts) {
    const maxDepth = opts.maxDepth, minSamples = opts.minSamples || 1, lambda = opts.lambda || 0;
    const idxAll = samples.map((_, i) => i);
    function build(idx, depth) {
      const vals = idx.map((i) => samples[i].t);
      const sum = vals.reduce((a, b) => a + b, 0), n = idx.length;
      const value = sum / (n + lambda);
      const node = { leaf: true, value, count: n, depth };
      if (depth >= maxDepth || n < 2 * minSamples) return node;
      const sorted = [...idx].sort((a, b) => samples[a].x - samples[b].x);
      const parent = sse(vals);
      let best = null;
      for (let s = 0; s < sorted.length - 1; s++) {
        const a = samples[sorted[s]].x, b = samples[sorted[s + 1]].x;
        if (a === b) continue;
        const t = (a + b) / 2;
        const L = idx.filter((i) => samples[i].x <= t), R = idx.filter((i) => samples[i].x > t);
        if (L.length < minSamples || R.length < minSamples) continue;
        const gain = parent - sse(L.map((i) => samples[i].t)) - sse(R.map((i) => samples[i].t));
        if (!best || gain > best.gain) best = { t, L, R, gain };
      }
      if (!best || best.gain <= 1e-9) return node;
      return { leaf: false, t: best.t, value, count: n, depth, left: build(best.L, depth + 1), right: build(best.R, depth + 1) };
    }
    return build(idxAll, 0);
  }
  function predictReg(node, x) { while (!node.leaf) node = x <= node.t ? node.left : node.right; return node.value; }

  function countLeaves(n) { return n.leaf ? 1 : countLeaves(n.left) + countLeaves(n.right); }
  function treeDepth(n) { return n.leaf ? n.depth : Math.max(treeDepth(n.left), treeDepth(n.right)); }

  return { impurity, buildClassTree, predict, buildRegTree, predictReg, countLeaves, treeDepth };
})();
