# MentalPlayground

A collection of single-page JavaScript apps built for learning. Each one is
visual, self-contained, and runs with no build step — the goal is to make
abstract ideas (reinforcement learning, algorithms, simulations) into something
you can watch happen in the browser.

## Apps

| App | What it is |
| --- | --- |
| [Bikefight RL Simulator](bikefight/) | Two vehicles fight in an arena while a blue learner trains against a scripted bot via a TensorFlow.js DQN. Includes a live "Inside the Brain" panel that visualizes the network's observations, activations, and Q-values. |

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
