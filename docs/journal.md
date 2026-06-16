# Project Journal

Most recent entries first. Notes on what was done each day — decisions, ideas,
and changes.

## 2026-06-16

- **MIN-799 — Improve the Studio Machine panel.** Restructured
  `fundingAndMachineSection` (`venturestudio/app.js` + `style.css`): added a
  full-width **action bar** (title left; "Month N" label + Advance One Month
  (primary, top-right) + Edit Participants + Reset on the right), leaving the
  funding panel with only Add Investor / Fill VSC1. Replaced the old 3-node flow
  with a **left-to-right funnel** across the 10 product-pathway stages (RL1→RL10)
  — tapering silhouette columns (wide left, narrow right) with live venture name
  chips placed in their current stage, an "✗ N killed" attrition marker, and a
  "→ N spun out" exit cap — so the selection funnel is shown graphically. Added a
  full-width **spun-out strip** below showing each LLC's profit/mo (+) and cost/mo
  (−). Verified by the implementer with Playwright against the running dev server
  (fundraising → Fill VSC1 → advance 3 months: month label updates live, ventures
  move across funnel stages, "1 killed" appears, Advance disabled during
  fundraising, modal opens, tablet viewport wraps cleanly, zero JS errors) plus a
  screenshot. Implemented by Claude Sonnet 4.6 (default tier — issue had no
  `model:` label).

- **MIN-798 — Save & reload participants as CSV.** Added Export/Import CSV to the
  Edit Participants modal so a participant configuration can be saved to a file and
  reloaded. Two pure, testable helpers in `venturestudio/app.js`:
  `participantsToCsv(state)` (one row per contributor/operations/investor; columns
  `category,name,role,sharePercent,fundedMonthly,giveUpPercent,contributionAmount`;
  RFC-4180 quoting via `csvEscape`) and `csvToParticipants(text)` (tolerant parser
  handling quoted fields + optional header, fresh ids, numeric coercion, throws on
  empty/garbage). Export downloads via a Blob + temporary anchor; Import uses a
  hidden file input → `FileReader` → replaces the three lists, recomputes cohort
  shares, and rebuilds the modal in place (no auto-save, so the existing
  Cancel/Save snapshot semantics hold). Verified with a headless round-trip
  (3 contributors + 1 operations + 3 investors survive export→import with matching
  numbers; comma/quote names preserved; empty/garbage CSV throws) plus a
  render+modal smoke test. Implemented by Claude Sonnet 4.6 (default tier — issue
  had no `model:` label).

- **MIN-795 — Investors buy shares from participants; split capital vs operational
  costs.** Reworked the Venture Studio Simulator economics so investors hold **no
  base BSSS** — every participant earns the venture's shares through work and
  *gives up* a cut of them to the investor pool in exchange for monthly cash drawn
  from the fund (investor ownership = Σ give-ups, divided by cohort share). The
  fund now depletes **only by actual draws** (no flat operating budget); if nobody
  draws, it holds. Operations stops being a no-equity fee entity and becomes
  contributor-like (earns BSSS + gives up shares); the **10% LLC stewardship fee
  was dropped**. Two cost categories — contributors = capital (development),
  operations = operational (overhead) — are surfaced via running fund totals and a
  cap table grouped Operational / Capital / Investors. Key changes in
  `venturestudio/app.js`: new `payMonthlyDraws`, `fundedParticipants`, `opsSet`;
  `allocateMonthlyPoints` drops the investor base; operations gain
  sharePercent/fundedMonthly/giveUpPercent. Verified with a headless 18-month sim:
  every ownership table sums to 100%, default investor share of filled ≈ 12.3%
  (ops 35%×35%), operations keeps ≈ 22.8%, `capitalSpent` $0 / `operationalSpent`
  tracks the $15k/mo draw, no stewardship fee anywhere, render()/openEditModal()
  clean. Built on the unmerged MIN-793 branch. Implemented by Claude Opus 4.8.

- **MIN-793 — Separate the Steward from the Contributors.** Pulled the steward
  out of the Venture Studio Simulator's contributor list into a new top-level
  **Operations** category (`state.operations`, default "Ministry of Product" at
  $15k/mo). Operations charges a monthly fee from the VSC1 fund and collects the
  10% LLC stewardship fee, but earns **no** BSSS equity. Removed the `steward`
  role special-casing entirely (`isSteward`/`stewardSet`/`refreshStewardSet`,
  steward→"mop" pie/ownership mapping); contributors are now purely
  equity-earning builders and were rebalanced to 30/20/15% so the BSSS base
  (incl. 35% investor pool) still sums to 100. Added an Operations section to the
  Edit Participants modal (name + fee/mo, add/remove) and an Operations holder
  type to the cap table (fee → Funded column, stewardship fees → Distributions,
  no equity). Files: `venturestudio/app.js`, `venturestudio/README.md`. Verified
  with a headless sandbox sim (16 months, 7 spinouts): every LLC ownership table
  sums to 100% with no Operations equity, `ops_mop` accrued $180k in fund fees
  and ~$31k in stewardship fees, and `render()`/`openEditModal()` run clean.
  Implemented by Claude Sonnet 4.6 (default tier — issue had no `model:` label).

## 2026-06-13

### Data Science Playground — deep-learning trio (spec complete, 20/20)
- **CNN**: an interactive convolution. Paint a 16×16 image, pick or hand-edit a
  3×3 kernel (Sobel/edge/blur/sharpen), and watch the feature map respond; ReLU
  and 2×2 max-pooling toggles. Internal view shows the editable kernel and the
  exact patch·kernel dot product under the cursor.
- **RNN / LSTM**: a single gated memory cell — cellₜ = forget·cellₜ₋₁ + input·xₜ,
  outputₜ = out·tanh(cellₜ). Main view unrolls input / cell state / output over
  time; internal view shows the gate bars, the update equation, and the memory
  half-life. The forget-gate slider makes "how long memory lasts" tangible.
- **Transformers**: an interactive self-attention matrix. Deterministic (untrained)
  per-token query/key projections per head; click a row to select a token and see
  arcs to what it attends to. Heads / softmax temperature / positional-bias
  controls. Framed honestly as illustrating the mechanism, not a trained LM.
- Removed the roadmap stub (`upcoming.js`) now that all 20 spec screens are real.
  Smoke test exercises all 20; landing page nav has no "soon" entries left.

### Data Science Playground — Phase 5 sequential (Time Series, Q-Learning, RL)
- **Time Series Forecasting**: build a signal from trend + seasonality + noise
  (+ click-to-add shocks), decompose it (least-squares trend, averaged seasonal
  indices, residual σ), and forecast forward with a widening 95% band. Internal
  view pulls the trend / seasonal / residual components apart.
- **Q-Learning**: tabular control on an editable gridworld (paint walls / goal /
  pit / start). Main view draws each cell's four action-values as colored wedges
  + the greedy arrow + the gold greedy path from start; internal view charts
  return per episode. α / γ / ε sliders, train/step/reset.
- **Reinforcement Learning** as a multi-armed bandit (the cleanest explore-vs-
  exploit demo): ε-greedy / greedy / UCB, value estimates vs hidden truths, and
  an internal cumulative-regret + %-optimal chart.
- Smoke test now drives the sequential learners too: Q-learning reaches ~100%
  success on the default grid; the bandit under UCB reliably clears 55%+ optimal
  pulls. (ε-greedy can legitimately lock onto a wrong arm — the lesson the screen
  teaches — so the stable assertion uses UCB.) 17 ready screens; 3 remain.

### Data Science Playground — Neural Network (Phase 4 begins)
- **Neural Network**: a from-scratch MLP (no libraries) trained by backprop on 2D
  classification. Configurable hidden width, 1–2 hidden layers, tanh/ReLU,
  learning rate. Main view shows the decision-boundary heatmap bending to fit
  Circles / XOR / Spiral / Blobs; internal view is a live network graph — edges
  colored/weighted by sign and magnitude, nodes lit by the activation for the
  hovered input point.
- Extended the smoke test to actually *train* the iterative learners (logistic,
  SVM, now NN) and assert they learn: across repeated runs the NN reaches 100%
  on the nonlinear Circles set, confirming the hand-rolled backprop is correct.

### Data Science Playground — Phase 3 clustering
- **DBSCAN**: density-based clustering. Main view colors points by cluster, draws
  the within-ε link graph, rings noise in red, enlarges core points, and shows
  the ε disk around the hovered point. Internal view bars the core/border/noise
  counts. ε and MinPts sliders.
- **Hierarchical Clustering** (agglomerative): single/complete/average linkage,
  merging nearest clusters bottom-up. Internal view is a real **dendrogram** with
  a draggable cut line; branches below the cut are colored by their resulting
  cluster and the main-view points recolor to match. Verified the U-shaped
  merge tree renders and the cut→cluster-count mapping is correct.
- 13 ready screens now; smoke test green across all of them.

### Data Science Playground — Phase 2 tree ensembles (completes Phase 2)
- Extracted a shared **CART library** (`src/lib/cart.js`): classification trees
  (2D, with optional per-split feature bagging for forests) and 1D regression
  trees (with an L2 leaf regularizer for the XGBoost screen). Refactored the
  Decision Tree screen to use it — no behavior change, smoke test still green.
- **Random Forest**: bootstrap + random-subspace trees, majority vote. Main view
  shades by vote share (smooth boundary); internal view tiles the first 12
  individual trees' blocky, disagreeing regions so you see what averaging fixes.
- **Gradient Boosting** (1D regression): start at the mean, add small trees to
  the residuals. Main view shows the ensemble curve sharpening; internal view
  shows the residual stems and the newest tree's step contribution. Step/Play
  through rounds, learning-rate and depth knobs.
- **XGBoost**: boosting + lambda (L2 leaf penalty) + a held-out validation set.
  Internal view is the train-vs-validation RMSE curve with the best-round marker
  — the canonical overfitting picture. Depth/lr/lambda all push the turning point.
- Removed the three from the `soon` roadmap; wired `cart.js` and the new screens
  into index.html and the smoke test (11 ready screens now exercised).

### Data Science Playground — Phase 2 classifiers
- Added the three boundary/probabilistic classifiers from Phase 2:
  **Logistic Regression** (gradient descent on log-loss, probability heatmap,
  movable decision threshold, sigmoid view placing each point by its score),
  **SVM** (linear soft-margin trained with Pegasos sub-gradient steps; boundary +
  both margin lines + highlighted support vectors; a functional-margin bar chart
  as the internal view; C trades margin width vs errors), and **Naive Bayes**
  (Gaussian per-feature likelihoods, posterior shading, per-class σ/2σ ellipses,
  togglable features, 1D class-conditional bell curves internally).
- Removed those three from the `soon` roadmap list so they don't double-register.
- Fixed a **test-stub bug**: the fake DOM's `innerHTML = ""` wasn't clearing
  children, so screens accumulated across the smoke test and `querySelector` hit
  stale tables. Made the setter empty children like a real browser. The smoke
  test now also clicks Train on the iterative learners and asserts the training
  loop advances — logistic and SVM both reach 100% on separable data.

### New app: Data Science Playground (Phase 1)
- Built `datascience/` from `docs/DataScience_Playground_Spec.md` — a second app
  in the playground. Self-contained, no build step, vanilla JS loaded via script
  tags, same dark design language as Bikefight.
- **Shared engine** (`src/framework.js`): the spec's universal screen layout
  (data controls · hyperparameters · metrics · main viz · internal viz · key
  intuition), UI control builders (slider/button/toggle/select/metric/note), a
  `Plot` class with data↔pixel transforms + grid/point/line/rect drawing, a
  generic `enablePointEditing` helper (drag / click-to-add / shift-click-remove),
  dataset generators, and a hash-routed sidebar nav grouped by phase.
- **Phase 1 screens, fully interactive** (`src/algos/`): Linear Regression
  (drag points, gradient descent walking a live loss surface, residuals, exact
  solve), KNN (draggable query point, decision regions, neighbor-vote panel,
  leave-one-out accuracy), Decision Tree (axis-aligned regions + rendered tree
  with per-split info gain, Gini/entropy), K-Means (draggable centroids,
  assign/update stepping, inertia chart), PCA in 2D (principal axes, rotated
  PC-space view, variance explained, reduce-to-1D).
- Phases 2–5 from the spec are registered as `soon` so the full roadmap shows in
  the nav and each becomes a real screen as it's built.
- **Verification**: `node test/smoke.js` stands up a fake DOM + canvas stub,
  loads the real source, opens all 20 screens, runs render frames, and fires
  click/drag on each ready screen — all pass. Wired the app into the root landing
  page and README.

### Repo → MentalPlayground (multi-app reorg)
- Reframed the repo as **MentalPlayground**, a collection of single-page JS
  learning apps. Moved the entire Bikefight app into `bikefight/` (via `git mv`,
  preserving history) — relative paths inside it are unchanged so it still runs
  and `node bikefight/test/smoke.js` passes.
- Added a root **landing page** (`index.html`) with a card per app (Bikefight +
  a "more coming" placeholder) and a root **README** explaining the repo, how to
  run (serve root, pick an app), the layout, and how to add a new app.
- Kept `docs/journal.md` at the root as the repo-wide journal; Bikefight's own
  spec/notes moved to `bikefight/docs/`.
- Renamed the GitHub repo `bikefightsimulator` → `MentalPlayground` (GitHub
  redirects the old URL), updated the local `origin` remote, and pushed `main`.
  The local folder is still `bikefightsimulator/` (cosmetic; can be renamed
  manually outside the session). Confirmed the cert warning the user saw was
  their Netgear router admin page (routerlogin.net), unrelated to this work.

### Brain viz: drop tabs, run alongside sim, add hover explainers
- Removed the Simulator/Brain tab switch. The arena and the brain now render
  **simultaneously** — arena + stats on the top row, the brain panel spans the
  full width below. The brain draws every frame (one extra forward pass/frame),
  independent of sim speed.
- Added **hover explainers** on the brain canvas: `BrainRenderer.buildRegions()`
  defines labelled rectangles mirroring the layout, `hitTest(x,y)` finds the one
  under the cursor, and `main.js` shows a positioned tooltip (flips at viewport
  edges). Each explains what the part is *and why it matters* — observation,
  input/hidden layers, Q-values, explore/exploit, epsilon, replay buffer, step
  counters, and training loss.
- Dropped the duplicate in-canvas title (now an HTML heading above the canvas);
  kept the live explore/exploit badge.

## 2026-06-12

### RL visualization ("Inside the Brain" tab)
- Added a tabbed view in the arena panel: **Simulator** (the existing arena) and
  **Inside the Brain**, a live look at the DQN's forward pass. The side panel
  (controls/stats) stays visible on both, so you can train and watch at once.
- Shows, updated every frame: the 15-value **observation** as signed bars (what
  the bike sees), the **network** as columns of neurons colored by activation
  with connection lines that brighten with the source neuron's firing, the 11
  **Q-values** as bars with the greedy pick highlighted and an
  explore/exploit badge, and **training internals** (epsilon, replay-buffer
  fill, env/gradient step counts, and a live training-loss sparkline).
- Implementation: `src/brainViz.js` (`BrainRenderer`, pure canvas). Added
  `DQNAgent.getActivations(obs)` which builds a cached `tf.model` over the live
  model's layer outputs (rebuilt if the model is swapped on import) to extract
  hidden-layer activations + Q-values in one forward pass. `main.js` records the
  last decision (action + whether it was a random explore step) and recent
  losses, and only computes/draws the brain when its tab is active (one forward
  pass per frame, independent of sim speed).
- Decision: kept the observation at 15 inputs and reused the same forward pass
  for both the action and the viz to avoid slowing training, especially at 50x.

### Workflow
- Started keeping this journal (newest date at top).
- Established practice: commit after each request.

### Gameplay rules
- **Turning requires motion.** A bike can't pivot while stopped; turn rate
  scales with speed and reaches full agility at ~35% of top speed
  (`turnFullSpeedFrac`) so it can still swerve without being at full throttle.
- **Reverse.** The brake control now carries speed negative, capped at 1/3 of
  top speed (`reverseSpeedFactor`), so a stuck bike can back out. Steering works
  in reverse (scaled by speed magnitude); coasting drag always bleeds toward 0.

### Obstacles
- **Green obstacles** placeable by clicking the arena (`obstacle.radius`, 28).
  They block projectiles and the bikes physically collide with them. Persist
  across episodes. **Clear Obstacles** button removes them all.

### Collision avoidance
- Bikes **sense** obstacles: the front/left/right clearance sensors now report
  the nearest of wall-or-obstacle (ray-vs-circle), folded into the existing
  15-value observation (no size change, exported brains still load). The
  scripted bot steers around obstacles using the same `clearance()`.
- Bikes **slide** along walls and obstacles instead of grinding to a halt: on
  contact the heading is redirected along the surface tangent (`slideHeading`)
  and most speed is retained (`slideSpeedRetain`, 0.92). Walls previously hard-
  stopped at 0.4 — now unified with the obstacle slide.

### Stats
- Added a **Record (W–L–D)** stat tracking blue's all-time wins/losses/draws,
  alongside the rolling Win Rate (last 100). Resets with Reset Brain.

### Reward rebalance (why blue kept fleeing)
- Diagnosis: the old `+0.05/tick` alive bonus paid ~+36 per episode just for
  surviving, so with a competent red bot the optimal policy was to flee and
  bank survival points. Blue learned cowardice and never won.
- Fix: removed the alive bonus, made stalling cost (`timeTick` −0.03), raised
  the aim reward (`enemyInCone` +0.5), softened the fear of fighting
  (`hitByEnemy` −15, `eliminated` −50), and bumped offense (`hitEnemy` +30,
  `enemyEliminated` +120). Requires Reset Brain + retrain to take effect.
- Open question: if blue now over-rushes and dies a lot, ease `eliminated`
  toward −70 / drop `enemyInCone` to ~0.3. If it engages but still loses, the
  red bot may simply be too strong → ease the bot instead of the rewards.
