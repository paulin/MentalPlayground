# Running the Bikefight RL Simulator

The simulator is a static one-page app — there is no build step and no
dependencies to install.

## Quick start

From the repository root, serve the folder with any static file server:

```sh
npx serve .
# or
python3 -m http.server 8000
```

Then open the printed URL in your browser (e.g. http://localhost:8000).

Opening `index.html` directly via `file://` also works in most browsers.

TensorFlow.js loads from the jsdelivr CDN. For fully offline use, copy
`dist/tf.min.js` from the `@tensorflow/tfjs` npm package into
`vendor/tf.min.js` — the page falls back to it automatically when the CDN is
unreachable.

## Using the app

The blue vehicle is the DQN learner; the red vehicle is the scripted bot.

### Controls

- **Start Training** — runs episodes of learner vs bot, training the network
  from the replay buffer as it goes. Epsilon (exploration rate) decays from
  1.0 toward 0.05 over time.
- **Pause** — freezes the simulation; training state is kept.
- **Run Best Brain** — plays greedy matches (no exploration) using the
  weights snapshot that achieved the best rolling win rate during training.
  If no snapshot exists yet, the current network is used.
- **Reset Brain** — discards the network, replay buffer, statistics, and
  best-brain snapshot.
- **Speed 1x / 10x / 50x** — simulation ticks per rendered frame. Use 50x
  for fast training; expect noticeable behavior change over a few hundred
  episodes.

### Statistics

- **Episode** — completed training episodes this session.
- **Win Rate (last 100)** — fraction of the last 100 episodes the learner won.
- **Avg Reward (last 100)** — mean total episode reward; should trend upward
  as learning progresses.
- **Epsilon** — current exploration rate.
- **Hits Dealt / Taken** — cumulative projectile hits this session.
- **Best Win Rate** — best 25-episode rolling win rate seen so far (the
  point at which the "best brain" snapshot was taken).
- The chart plots per-episode reward (blue) and its 20-episode moving
  average (orange).

### Persistence

- **Export Brain** — downloads the current model as `bikefight-dqn.json`
  plus `bikefight-dqn.weights.bin`.
- **Import Brain** — select **both** exported files together in the file
  picker to restore a model.

## Tests

```sh
node test/smoke.js   # headless physics/combat sanity check (no browser)
node test/e2e.js     # full browser test via Playwright (needs Chromium)
```

## Tuning

All gameplay and RL constants live in `src/config.js`: arena size, vehicle
physics, gun parameters, reward values, and DQN hyperparameters.
