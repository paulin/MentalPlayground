"use strict";

// Human-readable labels for the 15 observation inputs (must match the order in
// Simulation.getObservation).
const OBS_LABELS = [
  "pos x", "pos y", "sin θ", "cos θ", "speed",
  "enemy dx", "enemy dy", "enemy dist", "sin rel", "cos rel",
  "in cone", "reloaded", "clear ahead", "clear left", "clear right",
];

const BG = "#1b1e27";
const PANEL = "#14161c";
const GRID = "#262a35";
const TEXT = "#9aa3b5";
const TEXT_BRIGHT = "#f0f2f7";
const POS = [63, 185, 80];   // green for positive values
const NEG = [240, 90, 90];   // red for negative values
const ACT = [78, 163, 240];  // blue for neuron activations

function lerp(a, b, t) { return a + (b - a) * t; }

// Diverging color for a signed value in roughly [-1, 1]
function signedColor(v) {
  const t = Math.max(0, Math.min(1, Math.abs(v)));
  const c = v >= 0 ? POS : NEG;
  const r = Math.round(lerp(40, c[0], t));
  const g = Math.round(lerp(45, c[1], t));
  const b = Math.round(lerp(55, c[2], t));
  return `rgb(${r},${g},${b})`;
}

// Sequential color for a non-negative activation in [0, 1]
function actColor(t) {
  t = Math.max(0, Math.min(1, t));
  const r = Math.round(lerp(30, ACT[0], t));
  const g = Math.round(lerp(34, ACT[1], t));
  const b = Math.round(lerp(45, ACT[2], t));
  return `rgb(${r},${g},${b})`;
}

class BrainRenderer {
  constructor(canvas, actionNames) {
    this.ctx = canvas.getContext("2d");
    this.w = canvas.width;
    this.h = canvas.height;
    this.actionNames = actionNames;
    this.regions = this.buildRegions();
  }

  // Hover regions (canvas coordinates) with plain-language explanations. These
  // rectangles mirror the layout drawn below.
  buildRegions() {
    const W = this.w;
    return [
      {
        x: W - 228, y: 6, w: 220, h: 22,
        title: "Explore vs exploit",
        body: "Each tick the bike either takes a random action (explore) to discover new tactics, or its best-known action (exploit). It explores with probability epsilon, so early training is mostly random and shifts to deliberate play as epsilon decays.",
      },
      {
        x: 12, y: 36, w: 150, h: 404,
        title: "Observation — what the bike senses",
        body: "The 15 numbers fed into the network this instant: own position, heading and speed; the enemy's relative position, distance and angle; whether the enemy is in the firing cone and the gun is reloaded; and clear distance ahead/left/right. This is the only information the bike has — better sensing means better decisions.",
      },
      {
        x: 220, y: 56, w: 60, h: 422,
        title: "Input layer (15 neurons)",
        body: "One neuron per observation value — where information enters the network.",
      },
      {
        x: 340, y: 56, w: 200, h: 422,
        title: "Hidden layers (64 + 64, ReLU)",
        body: "These neurons combine the inputs into higher-level features like \"enemy is to my left and in range.\" Brighter = more active. Connection lines brighten with the firing strength of the neuron they leave, so you can watch a signal propagate left to right.",
      },
      {
        x: 580, y: 56, w: W - 584, h: 404,
        title: "Q-values — expected reward per action",
        body: "The network's estimate of total future reward for each of the 11 actions if taken right now. The bike normally picks the highest (\"best\", highlighted). Learning means nudging these estimates toward the rewards actually observed — this is the heart of what the DQN learns.",
      },
      {
        x: 12, y: 498, w: 212, h: 32,
        title: "Epsilon — exploration rate",
        body: "The probability of a random action. Starts at 1.0 (all random) and decays toward 0.05, so the bike gradually trusts what it has learned instead of guessing.",
      },
      {
        x: 12, y: 532, w: 212, h: 40,
        title: "Replay buffer",
        body: "A memory of past transitions (state, action, reward, next state). Training samples random batches from it, which breaks the correlation between consecutive steps and stabilizes learning. Training only starts once the buffer has enough samples.",
      },
      {
        x: 235, y: 498, w: 165, h: 62,
        title: "Step counters",
        body: "Env steps: simulation ticks the bike has lived through. Gradient steps: how many times the network's weights have actually been updated.",
      },
      {
        x: 410, y: 486, w: W - 422, h: 92,
        title: "Training loss",
        body: "How far the network's Q-value predictions were from their temporal-difference targets at each weight update. It's naturally noisy in reinforcement learning, but a broadly downward or stable trend means learning is converging.",
      },
    ];
  }

  // Returns the region under a canvas-space point, or null.
  hitTest(px, py) {
    for (const r of this.regions) {
      if (px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h) return r;
    }
    return null;
  }

  // state: { obs, q, activations:[h1,h2], chosenAction, greedyAction, wasExplore,
  //          epsilon, epsilonMin, envSteps, trainSteps, bufferSize, bufferCap,
  //          losses:[], training }
  draw(state) {
    const ctx = this.ctx;
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, this.w, this.h);

    if (!state || !state.obs) {
      ctx.fillStyle = TEXT;
      ctx.font = "14px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Press Start Training (or Run Best Brain) to watch the network think.", this.w / 2, this.h / 2);
      ctx.textAlign = "left";
      return;
    }

    this.drawHeader(state);
    this.drawObservation(state);          // left column
    this.drawNetwork(state);              // center columns + connections
    this.drawQValues(state);              // right column (output layer)
    this.drawTraining(state);             // bottom strip
  }

  drawHeader(s) {
    const ctx = this.ctx;
    // explore / exploit badge
    const exploring = s.wasExplore;
    const label = exploring ? "EXPLORING (random)" : "EXPLOITING (greedy)";
    ctx.font = "bold 12px system-ui, sans-serif";
    const tw = ctx.measureText(label).width;
    const bx = this.w - tw - 24;
    ctx.fillStyle = exploring ? "#5a4a2d" : "#2d5a3d";
    ctx.fillRect(bx - 8, 8, tw + 16, 18);
    ctx.fillStyle = exploring ? "#ffd27a" : "#8fd18f";
    ctx.fillText(label, bx, 21);
  }

  drawObservation(s) {
    const ctx = this.ctx;
    const x = 12, top = 44, w = 150, rowH = 26;
    ctx.fillStyle = TEXT;
    ctx.font = "11px system-ui, sans-serif";
    ctx.fillText("OBSERVATION (what it sees)", x, top - 6);

    const midX = x + 78; // zero baseline for signed bars
    for (let i = 0; i < s.obs.length; i++) {
      const y = top + i * rowH;
      const v = s.obs[i];
      ctx.fillStyle = TEXT;
      ctx.font = "10px system-ui, sans-serif";
      ctx.fillText(OBS_LABELS[i] || `in ${i}`, x, y + 8);

      // bar track
      const barTop = y + 12, barH = 8, half = 30;
      ctx.fillStyle = GRID;
      ctx.fillRect(midX - half, barTop, half * 2, barH);
      // value bar from midline
      const t = Math.max(-1, Math.min(1, v));
      ctx.fillStyle = signedColor(v);
      if (t >= 0) ctx.fillRect(midX, barTop, half * t, barH);
      else ctx.fillRect(midX + half * t, barTop, -half * t, barH);

      ctx.fillStyle = "#717a8c";
      ctx.font = "9px system-ui, sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(v.toFixed(2), midX + half + 18, barTop + 7);
      ctx.textAlign = "left";
    }
  }

  // Returns the screen positions of nodes in a vertical column.
  columnPositions(values, cx, top, bottom) {
    const n = values.length;
    const span = bottom - top;
    const pts = [];
    for (let i = 0; i < n; i++) {
      const y = n === 1 ? (top + bottom) / 2 : top + (i / (n - 1)) * span;
      pts.push({ x: cx, y });
    }
    return pts;
  }

  drawNetwork(s) {
    const ctx = this.ctx;
    const [h1, h2] = s.activations;
    const top = 70, bottom = 470;

    // Column x positions: input -> hidden1 -> hidden2 -> (output drawn by Q panel)
    const inX = 250, h1X = 380, h2X = 510, outX = 600;
    const inPts = this.columnPositions(s.obs, inX, top, bottom);
    const h1Pts = this.columnPositions(h1, h1X, top, bottom);
    const h2Pts = this.columnPositions(h2, h2X, top, bottom);
    const outPts = this.columnPositions(s.q, outX, top, bottom);

    // Layer captions
    ctx.fillStyle = TEXT;
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`input · ${s.obs.length}`, inX, top - 12);
    ctx.fillText(`hidden · ${h1.length}`, h1X, top - 12);
    ctx.fillText(`hidden · ${h2.length}`, h2X, top - 12);
    ctx.fillText(`Q · ${s.q.length}`, outX, top - 12);
    ctx.textAlign = "left";

    // Sparse connection lines, brightened by source activation, so active
    // neurons visibly "light up" their links without drawing thousands of lines.
    this.drawConnections(inPts, h1Pts, s.obs.map((v) => Math.abs(v)));
    this.drawConnections(h1Pts, h2Pts, h1, true);
    this.drawConnections(h2Pts, outPts, h2, true);

    // Nodes
    this.drawNodes(inPts, s.obs, false);
    const m1 = Math.max(1e-6, Math.max(...h1));
    const m2 = Math.max(1e-6, Math.max(...h2));
    this.drawNodes(h1Pts, h1.map((v) => v / m1), true);
    this.drawNodes(h2Pts, h2.map((v) => v / m2), true);
  }

  drawConnections(fromPts, toPts, srcVals, normalize) {
    const ctx = this.ctx;
    const max = normalize ? Math.max(1e-6, Math.max(...srcVals)) : 1;
    const fanout = 3;
    for (let i = 0; i < fromPts.length; i++) {
      const a = fromPts[i];
      const strength = Math.max(0, Math.min(1, srcVals[i] / max));
      ctx.strokeStyle = `rgba(78,163,240,${0.015 + 0.18 * strength})`;
      ctx.lineWidth = 1;
      for (let k = 0; k < fanout; k++) {
        // deterministic spread of targets so the diagram is stable frame to frame
        const j = ((i * 7 + k * 23) % toPts.length);
        const b = toPts[j];
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }
  }

  drawNodes(pts, vals, activation) {
    const ctx = this.ctx;
    const radius = pts.length > 30 ? 2.4 : 4;
    for (let i = 0; i < pts.length; i++) {
      ctx.fillStyle = activation ? actColor(vals[i]) : signedColor(vals[i]);
      ctx.beginPath();
      ctx.arc(pts[i].x, pts[i].y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawQValues(s) {
    const ctx = this.ctx;
    const x = 620, top = 70, w = this.w - x - 12, rowH = 34;
    ctx.fillStyle = TEXT;
    ctx.font = "11px system-ui, sans-serif";
    ctx.fillText("Q-VALUES (expected reward per action)", x, top - 14);

    const q = s.q;
    const min = Math.min(...q), max = Math.max(...q);
    const range = max - min || 1;
    const barX = x + 4, barMaxW = w - 8;

    for (let i = 0; i < q.length; i++) {
      const y = top + i * rowH;
      const isGreedy = i === s.greedyAction;
      const isChosen = i === s.chosenAction;

      // action name
      ctx.fillStyle = isChosen ? TEXT_BRIGHT : TEXT;
      ctx.font = (isChosen ? "bold " : "") + "11px system-ui, sans-serif";
      ctx.fillText(this.actionNames[i], barX, y + 9);

      // bar (normalized within the current min..max so the best stands out)
      const t = (q[i] - min) / range;
      const bw = Math.max(2, barMaxW * t);
      const by = y + 13, bh = 9;
      ctx.fillStyle = GRID;
      ctx.fillRect(barX, by, barMaxW, bh);
      ctx.fillStyle = isGreedy ? "#4ea3f0" : "#3a4a5e";
      ctx.fillRect(barX, by, bw, bh);

      // value + markers
      ctx.fillStyle = "#717a8c";
      ctx.font = "9px system-ui, sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(q[i].toFixed(2), x + w, y + 9);
      ctx.textAlign = "left";

      if (isGreedy) {
        ctx.fillStyle = "#8fd18f";
        ctx.fillText("◀ best", barX + bw + 6, by + 8);
      }
    }

    // Note which action actually fired this tick
    ctx.fillStyle = s.wasExplore ? "#ffd27a" : "#8fd18f";
    ctx.font = "11px system-ui, sans-serif";
    const note = s.wasExplore
      ? `took: ${this.actionNames[s.chosenAction]} (random)`
      : `took: ${this.actionNames[s.chosenAction]} (best)`;
    ctx.fillText(note, barX, top + q.length * rowH + 6);
  }

  drawTraining(s) {
    const ctx = this.ctx;
    const top = 486, x = 12;
    ctx.strokeStyle = GRID;
    ctx.beginPath();
    ctx.moveTo(x, top - 8);
    ctx.lineTo(this.w - 12, top - 8);
    ctx.stroke();

    ctx.fillStyle = TEXT;
    ctx.font = "11px system-ui, sans-serif";
    ctx.fillText("TRAINING INTERNALS", x, top + 6);

    // Epsilon bar (exploration rate)
    this.metricBar(x, top + 16, 200, "epsilon (explore rate)",
      s.epsilon, s.epsilonMin, 1, s.epsilon.toFixed(3));

    // Replay buffer fill
    this.metricBar(x, top + 50, 200, "replay buffer",
      s.bufferSize, 0, s.bufferCap, `${s.bufferSize} / ${s.bufferCap}`);

    // Counters
    ctx.fillStyle = TEXT;
    ctx.font = "11px system-ui, sans-serif";
    ctx.fillText(`env steps: ${s.envSteps}`, x + 230, top + 24);
    ctx.fillText(`gradient steps: ${s.trainSteps}`, x + 230, top + 42);
    const lastLoss = s.losses.length ? s.losses[s.losses.length - 1] : null;
    ctx.fillText(`loss: ${lastLoss == null ? "—" : lastLoss.toFixed(3)}`, x + 230, top + 60);

    // Loss sparkline
    this.lossSparkline(x + 400, top + 14, this.w - x - 412, 76, s.losses);
  }

  metricBar(x, y, w, label, val, lo, hi, valText) {
    const ctx = this.ctx;
    ctx.fillStyle = TEXT;
    ctx.font = "10px system-ui, sans-serif";
    ctx.fillText(label, x, y + 8);
    const by = y + 12, bh = 8;
    const t = Math.max(0, Math.min(1, (val - lo) / (hi - lo || 1)));
    ctx.fillStyle = GRID;
    ctx.fillRect(x, by, w, bh);
    ctx.fillStyle = "#4ea3f0";
    ctx.fillRect(x, by, w * t, bh);
    ctx.fillStyle = "#717a8c";
    ctx.font = "9px system-ui, sans-serif";
    ctx.fillText(valText, x, by + 20);
  }

  lossSparkline(x, y, w, h, losses) {
    const ctx = this.ctx;
    ctx.fillStyle = TEXT;
    ctx.font = "10px system-ui, sans-serif";
    ctx.fillText("training loss", x, y - 2);
    ctx.fillStyle = PANEL;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = GRID;
    ctx.strokeRect(x, y, w, h);
    if (losses.length < 2) return;
    const data = losses.slice(-200);
    const max = Math.max(...data);
    const min = Math.min(...data);
    const range = max - min || 1;
    ctx.strokeStyle = "#ffb347";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    data.forEach((v, i) => {
      const px = x + (i / (data.length - 1)) * w;
      const py = y + h - 4 - ((v - min) / range) * (h - 8);
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    });
    ctx.stroke();
  }
}
