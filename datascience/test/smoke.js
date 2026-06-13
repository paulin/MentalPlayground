"use strict";

// Headless smoke test for the Data Science Playground. There's no build step and
// the code is browser-coupled, so we stand up a minimal fake DOM + 2D-canvas stub,
// load the real framework and every algorithm file into one VM context, then:
//   1. init the app,
//   2. open every screen (simulate a nav click),
//   3. run a few animation frames so each render path executes,
//   4. fire a click + drag on each main canvas to exercise interaction handlers.
// Any thrown error -> non-zero exit. Run with: node test/smoke.js
//
// This can't catch visual/layout problems (no real rendering) — only that the
// logic wires up and runs without exceptions across all screens.

const fs = require("fs");
const path = require("path");
const vm = require("vm");

function fail(msg) { console.error("FAIL:", msg); process.exit(1); }
function assert(cond, msg) { if (!cond) fail(msg); }

// --- 2D canvas context stub (records nothing; just must not throw) ----------
function ctx2d() {
  const noop = () => {};
  return {
    fillStyle: "", strokeStyle: "", lineWidth: 1, font: "", textAlign: "", textBaseline: "",
    fillRect: noop, strokeRect: noop, clearRect: noop, beginPath: noop, closePath: noop,
    moveTo: noop, lineTo: noop, arc: noop, arcTo: noop, ellipse: noop, rect: noop, fill: noop, stroke: noop,
    save: noop, restore: noop, translate: noop, rotate: noop, scale: noop, setLineDash: noop,
    fillText: noop, strokeText: noop, measureText: () => ({ width: 0 }),
    createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
    getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
    putImageData: noop,
  };
}

// --- minimal DOM ------------------------------------------------------------
function matches(node, sel) {
  // supports "tag", ".cls", "tag.cls", ".a.b"
  let tag = null; const classes = [];
  sel.replace(/([a-z0-9]+)?((?:\.[\w-]+)*)/i, (_, t, cls) => {
    if (t) tag = t.toUpperCase();
    (cls.match(/\.[\w-]+/g) || []).forEach((c) => classes.push(c.slice(1)));
    return "";
  });
  if (tag && node.tagName !== tag) return false;
  return classes.every((c) => node._cls.has(c));
}
function walk(node, fn) { for (const c of node.children) { fn(c); walk(c, fn); } }

function makeEl(tag) {
  const node = {
    tagName: (tag || "").toUpperCase(), tag, id: "", children: [], parentNode: null,
    _listeners: {}, _cls: new Set(), dataset: {}, style: {},
    textContent: "", value: "", checked: false, type: "", href: "",
    width: 300, height: 300, _html: "",
    get className() { return [...this._cls].join(" "); },
    set className(v) { this._cls = new Set(String(v).split(/\s+/).filter(Boolean)); },
    get innerHTML() { return this._html; },
    set innerHTML(v) { this._html = v; if (v === "") this.children = []; }, // empty = clear children, like a real browser
    classList: {
      add: (...c) => c.forEach((x) => node._cls.add(x)),
      remove: (...c) => c.forEach((x) => node._cls.delete(x)),
      contains: (c) => node._cls.has(c),
      toggle: (c, f) => { const on = f === undefined ? !node._cls.has(c) : !!f; on ? node._cls.add(c) : node._cls.delete(c); return on; },
    },
    append(...kids) { kids.forEach((k) => { if (k && typeof k === "object") { k.parentNode = node; node.children.push(k); } }); },
    appendChild(k) { node.append(k); return k; },
    addEventListener(t, fn) { (node._listeners[t] = node._listeners[t] || []).push(fn); },
    removeEventListener(t, fn) { const a = node._listeners[t]; if (a) { const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); } },
    dispatch(t, ev) { (node._listeners[t] || []).slice().forEach((fn) => fn(ev)); },
    querySelector(sel) { let found = null; walk(node, (n) => { if (!found && matches(n, sel)) found = n; }); return found; },
    querySelectorAll(sel) { const out = []; walk(node, (n) => { if (matches(n, sel)) out.push(n); }); return out; },
    getBoundingClientRect() { return { left: 0, top: 0, width: node.width, height: node.height }; },
    getContext() { return node._ctx || (node._ctx = ctx2d()); },
    remove() { if (node.parentNode) { const i = node.parentNode.children.indexOf(node); if (i >= 0) node.parentNode.children.splice(i, 1); } },
  };
  return node;
}

const root = makeEl("body");
const stage = makeEl("main"); stage.id = "stage";
const nav = makeEl("nav"); nav.id = "nav";
root.append(nav, stage);

const document = {
  createElement: (t) => makeEl(t),
  getElementById: (id) => { let f = null; walk(root, (n) => { if (n.id === id) f = n; }); return f; },
  querySelector: (s) => root.querySelector(s),
  querySelectorAll: (s) => root.querySelectorAll(s),
  body: root,
};

// --- requestAnimationFrame queue we can drain deterministically -------------
let frames = []; let nextId = 1;
function requestAnimationFrame(cb) { const id = nextId++; frames.push({ id, cb }); return id; }
function cancelAnimationFrame(id) { frames = frames.filter((f) => f.id !== id); }
function drain(rounds) {
  for (let r = 0; r < rounds; r++) {
    const snap = frames; frames = [];
    for (const f of snap) f.cb(r * 16);
  }
}

const windowObj = {
  addEventListener: (t, fn) => { (windowObj._l = windowObj._l || {}), (windowObj._l[t] = windowObj._l[t] || []).push(fn); },
  removeEventListener: (t, fn) => { const a = windowObj._l && windowObj._l[t]; if (a) { const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); } },
  dispatch: (t, ev) => { const a = windowObj._l && windowObj._l[t]; if (a) a.slice().forEach((fn) => fn(ev)); },
};
const location = { hash: "" };

// --- load real source into one shared context -------------------------------
const base = path.join(__dirname, "..");
const files = [
  "src/framework.js",
  "src/lib/cart.js",
  "src/algos/linearRegression.js",
  "src/algos/knn.js",
  "src/algos/decisionTree.js",
  "src/algos/kmeans.js",
  "src/algos/pca.js",
  "src/algos/logisticRegression.js",
  "src/algos/svm.js",
  "src/algos/naiveBayes.js",
  "src/algos/randomForest.js",
  "src/algos/gradientBoosting.js",
  "src/algos/xgboost.js",
  "src/algos/upcoming.js",
];
const source = files.map((f) => fs.readFileSync(path.join(base, f), "utf8")).join("\n;\n");

const sandbox = {
  document, window: windowObj, location, requestAnimationFrame, cancelAnimationFrame,
  Math, JSON, Array, Object, Number, String, Uint8ClampedArray, console, isNaN, isFinite, parseInt, parseFloat,
};
sandbox.window.document = document;
vm.createContext(sandbox);

try {
  // `const DSP` is lexically scoped to the script and won't attach to the VM
  // global; re-export it through a top-level `var` so the test can reach it.
  vm.runInContext(source + "\n;DSP.init();\nvar DSP_EXPORT = DSP;", sandbox, { filename: "datascience-bundle.js" });
} catch (e) {
  fail("loading/init threw: " + (e && e.stack || e));
}

const DSP = sandbox.DSP_EXPORT;
assert(DSP && typeof DSP.init === "function", "DSP did not initialize");

// Count screens registered.
const navItems = document.querySelectorAll(".nav-item");
assert(navItems.length >= 20, `expected the full roadmap in the nav, got ${navItems.length}`);

const readyIds = ["linear-regression", "knn", "decision-tree", "kmeans", "pca",
  "logistic-regression", "svm", "naive-bayes",
  "random-forest", "gradient-boosting", "xgboost"];

// Open every screen and run it.
let opened = 0;
for (const item of navItems) {
  const id = item.dataset.id;
  try {
    item.dispatch("click", { preventDefault() {}, button: 0 });
    drain(3); // run a few render frames
    // exercise interaction on ready screens: click + drag on the first canvas
    if (readyIds.includes(id)) {
      const canvas = stage.querySelector("canvas");
      assert(canvas, `${id}: no canvas rendered`);
      assert(stage.querySelectorAll("canvas").length >= 2, `${id}: expected main + internal canvases`);
      canvas.dispatch("mousedown", { clientX: 180, clientY: 180, button: 0, shiftKey: false, preventDefault() {} });
      windowObj.dispatch("mousemove", { clientX: 220, clientY: 160 });
      windowObj.dispatch("mouseup", {});
      drain(2);
      // shift-click to remove a point
      canvas.dispatch("mousedown", { clientX: 180, clientY: 160, button: 0, shiftKey: true, preventDefault() {} });
      drain(2);
      // verify metrics table got populated
      const metricsTable = stage.querySelector("table.metrics");
      assert(metricsTable, `${id}: no metrics rendered`);

      // For the iteratively-trained screens, click the train button and run many
      // frames, then confirm the training loop actually advanced (step counter > 0).
      if (id === "logistic-regression" || id === "svm") {
        let btn = null;
        for (const b of stage.querySelectorAll("button")) {
          if (/run gradient|train/i.test(b.textContent)) { btn = b; break; }
        }
        assert(btn, `${id}: no train button found`);
        btn.dispatch("click", { preventDefault() {} });
        drain(200);
        const lastVal = metricsTable.querySelectorAll("td.metric-val").pop();
        const steps = Number(lastVal.textContent);
        assert(Number.isFinite(steps) && steps > 0, `${id}: training loop did not advance (steps=${lastVal.textContent})`);
      }
    }
    opened++;
  } catch (e) {
    fail(`screen "${id}" threw: ` + (e && e.stack || e));
  }
}

console.log(`PASS: ${navItems.length} screens registered, ${opened} opened without error`);
console.log(`  ready screens fully exercised: ${readyIds.join(", ")}`);
