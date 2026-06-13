"use strict";

class ReplayBuffer {
  constructor(capacity) {
    this.capacity = capacity;
    this.buffer = [];
    this.pos = 0;
  }

  get size() {
    return this.buffer.length;
  }

  push(transition) {
    if (this.buffer.length < this.capacity) {
      this.buffer.push(transition);
    } else {
      this.buffer[this.pos] = transition;
    }
    this.pos = (this.pos + 1) % this.capacity;
  }

  sample(n) {
    const out = [];
    for (let i = 0; i < n; i++) {
      out.push(this.buffer[(Math.random() * this.buffer.length) | 0]);
    }
    return out;
  }

  clear() {
    this.buffer = [];
    this.pos = 0;
  }
}

class DQNAgent {
  constructor(cfg, obsSize, numActions) {
    this.cfg = cfg.dqn;
    this.obsSize = obsSize;
    this.numActions = numActions;
    this.buffer = new ReplayBuffer(this.cfg.bufferSize);
    this.epsilon = this.cfg.epsilonStart;
    this.envSteps = 0;
    this.trainSteps = 0;
    this.model = this.buildModel();
    this.target = this.buildModel();
    this.updateTarget();
  }

  buildModel() {
    const model = tf.sequential();
    model.add(
      tf.layers.dense({
        inputShape: [this.obsSize],
        units: this.cfg.hidden[0],
        activation: "relu",
      })
    );
    for (let i = 1; i < this.cfg.hidden.length; i++) {
      model.add(tf.layers.dense({ units: this.cfg.hidden[i], activation: "relu" }));
    }
    model.add(tf.layers.dense({ units: this.numActions }));
    model.compile({
      optimizer: tf.train.adam(this.cfg.learningRate),
      loss: "meanSquaredError",
    });
    return model;
  }

  act(obs, epsilon) {
    if (Math.random() < epsilon) {
      return (Math.random() * this.numActions) | 0;
    }
    return this.greedyAction(this.model, obs);
  }

  greedyAction(model, obs) {
    return tf.tidy(() => {
      const q = model.predict(tf.tensor2d([obs]));
      return q.argMax(1).dataSync()[0];
    });
  }

  // For the visualization tab: run one forward pass and return the activations
  // of every layer — [hidden1[], hidden2[], ..., qValues[]]. Shares weights with
  // the live model (an activation model is built lazily and rebuilt if the model
  // is swapped out, e.g. on import).
  getActivations(obs) {
    if (this._actModel == null || this._actModelFor !== this.model) {
      this._actModel = tf.model({
        inputs: this.model.inputs,
        outputs: this.model.layers.map((l) => l.output),
      });
      this._actModelFor = this.model; // don't dispose: weights are shared
    }
    return tf.tidy(() => {
      const outs = this._actModel.predict(tf.tensor2d([obs]));
      return outs.map((o) => Array.from(o.dataSync()));
    });
  }

  remember(s, a, r, s2, done) {
    this.buffer.push({ s, a, r, s2, done });
  }

  decayEpsilon() {
    this.epsilon = Math.max(this.cfg.epsilonMin, this.epsilon * this.cfg.epsilonDecay);
  }

  async train() {
    if (this.buffer.size < Math.max(this.cfg.minBufferToTrain, this.cfg.batchSize)) {
      return null;
    }
    const batch = this.buffer.sample(this.cfg.batchSize);
    const states = tf.tensor2d(batch.map((t) => t.s));
    const nextStates = tf.tensor2d(batch.map((t) => t.s2));
    const qCurT = this.model.predict(states);
    const qNextT = this.target.predict(nextStates);
    const qCur = await qCurT.array();
    const qNext = await qNextT.array();
    qCurT.dispose();
    qNextT.dispose();

    for (let i = 0; i < batch.length; i++) {
      const t = batch[i];
      const maxNext = Math.max(...qNext[i]);
      qCur[i][t.a] = t.r + (t.done ? 0 : this.cfg.gamma * maxNext);
    }
    const targets = tf.tensor2d(qCur);
    const loss = await this.model.trainOnBatch(states, targets);
    states.dispose();
    nextStates.dispose();
    targets.dispose();

    this.trainSteps++;
    if (this.trainSteps % this.cfg.targetUpdateEvery === 0) {
      this.updateTarget();
    }
    return loss;
  }

  updateTarget() {
    this.target.setWeights(this.model.getWeights().map((w) => w.clone()));
  }

  snapshotWeights() {
    return this.model.getWeights().map((w) => w.clone());
  }

  dispose() {
    this.model.dispose();
    this.target.dispose();
  }
}
