"use strict";

// The rest of the spec's roadmap. These register as "soon" so the full map of
// concepts is visible in the nav; each becomes a real screen as it's built.
[
  // Phase 3 — density / hierarchical clustering
  { id: "dbscan", name: "DBSCAN", phase: "Phase 3 — Unsupervised", intuition: "Clusters are dense regions; sparse points are just noise." },
  { id: "hierarchical", name: "Hierarchical Clustering", phase: "Phase 3 — Unsupervised", intuition: "Clusters exist at every scale; cut the dendrogram wherever you like." },

  // Phase 3 — deep learning
  { id: "neural-network", name: "Neural Network", phase: "Phase 4 — Deep Learning", intuition: "Stacked simple transformations compose into arbitrarily complex functions." },
  { id: "cnn", name: "CNN", phase: "Phase 4 — Deep Learning", intuition: "Patterns become features, features become objects." },
  { id: "rnn-lstm", name: "RNN / LSTM", phase: "Phase 4 — Deep Learning", intuition: "Past information is carried forward through a hidden state." },
  { id: "transformers", name: "Transformers", phase: "Phase 4 — Deep Learning", intuition: "The model learns what each token should pay attention to." },

  // Phase 4 — sequential decisions & time
  { id: "reinforcement-learning", name: "Reinforcement Learning", phase: "Phase 5 — Sequential", intuition: "Behavior emerges from maximizing long-run reward." },
  { id: "q-learning", name: "Q-Learning", phase: "Phase 5 — Sequential", intuition: "Every action has a long-term value; learn it from experience." },
  { id: "time-series", name: "Time Series Forecasting", phase: "Phase 5 — Sequential", intuition: "Trend, seasonality, and noise in the past shape the future." },
].forEach((d) => DSP.register({ ...d, status: "soon", blurb: d.intuition }));
