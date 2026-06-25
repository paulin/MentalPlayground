# MentalPlayground

A collection of single-page JavaScript apps built for learning. Each one is
visual, self-contained, and runs with no build step — the goal is to make
abstract ideas (reinforcement learning, algorithms, simulations) into something
you can watch happen in the browser.

## Apps

| App | What it is |
| --- | --- |
| [Bikefight RL Simulator](bikefight/) | Two vehicles fight in an arena while a blue learner trains against a scripted bot via a TensorFlow.js DQN. Includes a live "Inside the Brain" panel that visualizes the network's observations, activations, and Q-values. |
| [Data Science Playground](datascience/) | An interactive sandbox for rebuilding intuition about ML algorithms. Manipulate the data and hyperparameters and watch the internals update live. All 20 screens from the spec are built — across foundations, supervised learning, clustering, deep learning (incl. a from-scratch MLP, an interactive convolution/CNN, a gated RNN/LSTM memory cell, and a self-attention/Transformer matrix), and sequential decisions (Time Series Forecasting, Q-Learning gridworld, multi-armed-bandit RL). |
| [Venture Studio Simulator](venturestudio/) | An explanatory model of how a venture studio machine works — fund a cohort, flow capital to studio operations, run ideas through BSSS ownership stages, and spin winners out into LLCs with a simulated cap table. |
| [MJ Venture Studio](mjvs/) | A single-player, turn-based venture studio game (Incumbent Failure Arbitrage Studio model). Play a Studio Principal across seven phases — Discovery → Qualification → Validation → MVP → Revenue → Scale → Spinout — spending Cash and Runway, growing Reputation and Certainty, and accumulating contribution across seven categories into one of six endgame outcomes. |
| [MJVS AI Playtester](mjvs/playtest.html) | A rapid playtesting tool for MJ Venture Studio. An agent runs thousands of simulated games against the same engine and learns the smartest moves via lightweight search (evolutionary policy + Monte Carlo), then surfaces an optimal playbook per archetype, a leaderboard, and a "watch it reason" move inspector. The strategy slot is pluggable for Q-learning / DQN / MCTS later. |

_More to come — each new experiment lives in its own folder._

## Run it

No build step. Serve the repo root and open it in a browser:

```sh
npx serve .          # or: python3 -m http.server 8000
```

Open the printed URL (e.g. http://localhost:8000), and the landing page
(`index.html`) lists every app. Each app also runs standalone by opening its own
folder (e.g. http://localhost:8000/bikefight/).

## Layout

```
index.html          landing page that links to each app
README.md           this file
docs/journal.md     running dev journal across the whole repo (newest first)
bikefight/          the Bikefight RL Simulator (self-contained)
  index.html
  style.css
  src/
  test/
  docs/             app-specific spec and notes
```

## Adding a new app

1. Create a folder at the root (e.g. `mynewapp/`) with its own `index.html` and
   assets — keep it self-contained so it runs on its own.
2. Add a card linking to it in the root `index.html`, and a row in the **Apps**
   table above.
3. Note the addition in `docs/journal.md` (newest date at the top).
