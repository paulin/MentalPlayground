# Bikefight RL Simulator

A one-page browser app where two vehicles fight in an arena, and the blue
driver learns from repeated matches using a TensorFlow.js DQN. The red
opponent is a scripted bot. See `docs/Bikefight_RL_Simulator_Spec.md` for the
full specification.

## Run it

No build step. Serve the folder and open it in a browser:

```sh
npx serve .          # or: python3 -m http.server 8000
```

Then open the printed URL (e.g. http://localhost:8000). TensorFlow.js loads
from the jsdelivr CDN; for offline use, copy `dist/tf.min.js` from the
`@tensorflow/tfjs` npm package into `vendor/tf.min.js` and the page will fall
back to it automatically.

Opening `index.html` directly via `file://` also works in most browsers.

## Using it

- **Start Training** — runs episodes of learner (blue) vs scripted bot (red),
  training the DQN from a replay buffer as it goes.
- **Speed 1x / 10x / 50x** — simulation ticks per rendered frame. Use 50x to
  train fast; expect meaningful behavior to emerge over a few hundred episodes
  as epsilon decays toward 0.05.
- **Run Best Brain** — plays greedy (no exploration) matches using the
  weights snapshot with the best rolling win rate seen during training.
- **Click the arena** — drops a green obstacle where you click. Obstacles
  block shots and the bikes can't drive over them. **Clear Obstacles** removes
  them all. Obstacles persist across episodes.
- **Reset Brain** — discards the network, replay buffer, and statistics.
- **Export / Import Brain** — saves the model as `bikefight-dqn.json` +
  `bikefight-dqn.weights.bin` downloads; import expects both files selected
  together.

The chart shows per-episode total reward (blue) and its 20-episode moving
average (orange). The **Record (W–L–D)** stat tracks blue's all-time wins,
losses, and draws against the bot; **Win Rate (last 100)** is the rolling
fraction. Both reset with **Reset Brain**.

## Project layout

```
index.html          page layout, loads scripts
style.css
src/config.js       tunable constants, action space, observation size
src/sim.js          physics + combat simulation (no rendering dependency)
src/scriptedBot.js  the rule-based opponent
src/dqn.js          replay buffer + DQN agent (model, target net, training)
src/renderer.js     canvas drawing
src/main.js         training loop, UI wiring, stats, persistence
test/smoke.js       headless sim test: node test/smoke.js
test/e2e.js         browser test (Playwright): node test/e2e.js
```

## RL setup (per spec)

- 15-value observation: own pose/speed, relative enemy position/angle,
  firing-cone and reload flags, clearance distances (front/left/right) that
  combine wall and obstacle proximity
- 11 discrete actions combining throttle, steering, and fire
- Rewards: +30 hit, +120 elimination, −15 hit taken, −50 eliminated,
  −5 wall collision, −1 wasted shot, +0.5 enemy in cone, −0.03/tick. There is
  deliberately **no per-tick survival bonus** — an earlier `+0.05/tick` "alive"
  reward paid blue to flee and bank survival points, so it learned cowardice;
  rewards are now tuned so engaging beats running.
- DQN: 15 → 64 → 64 → 11 MLP, Adam lr 0.001, γ 0.95, batch 32, replay
  buffer 10k, ε 1.0 → 0.05, target network synced every 500 gradient steps

## Movement & obstacles

- A bike can only **steer while it's rolling** — a stationary bike can't pivot,
  but it reaches full turn agility at ~35% of top speed, so it can swerve
  around obstacles without needing to be at full throttle. Accelerate (or
  reverse) to aim.
- On contact, a bike **slides along walls and obstacles** — its heading is
  redirected along the surface and it keeps most of its speed (`slideSpeedRetain`)
  instead of grinding to a halt, so it no longer gets hung up in corners or
  against the green circles.
- The **brake control also reverses**: hold it to back up at up to 1/3 of top
  speed, so a bike wedged against a wall or obstacle can get unstuck.
- Green **obstacles** (click the arena to place them) block projectiles and the
  bikes physically collide with them, just like the arena walls. Both bikes
  **sense and avoid obstacles**: the front/left/right clearance sensors report
  the nearest of wall-or-obstacle, so the scripted bot steers around them and
  the learner can train to do the same (collisions still cost reward). The
  observation vector stays 15 values, so existing exported brains still load.
