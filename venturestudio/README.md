# Venture Studio Simulator

A one-page, no-build web app that visually explains how the Ministry of Product
venture studio machine works. It is an **explanatory model, not a legal cap
table** — every ownership, revenue, and distribution number is simulated,
estimated, and illustrative.

## What it shows

- **The studio machine** — a funding tank for **VSC1** (Venture Studio Cohort 1)
  and a live money-flow diagram: investors fund the cohort → the fund pays out
  what participants draw (capital + operational) → that work turns into ventures.
- **The venture pipeline** — a funnel of ideas moving through the 10 BSSS release
  levels (RL1 Idea → RL10 Stable). Each venture card shows its stage, MRR,
  customers, ops load, cash-flow status, and a **BSSS donut** that fills as
  stages complete. Most ideas are expected to stall or be killed.
- **Spinout LLCs** — when a venture clears the spinout bar (MRR ≥ $5k, positive
  cash flow, repeatable acquisition, stable product, ≤10 mgmt hrs/week) it can be
  spun out. BSSS ownership converts into a formal ownership table, and estimated
  monthly profit + distributions flow to owners by stake.

## BSSS (Big Slice / Small Slice)

Each stage opens a **Big Slice** with a fixed percentage of the venture. A
participant's **Small Slice** in that stage = their points ÷ total points in the
slice × the Big Slice %. Completed slices lock and can't be diluted. The donut
splits each filled wedge into investor (blue), operations (purple), and
contributor (green) sub-arcs; the active slice has a gold outline; planned future
stages are gray (unallocated).

## Participants, funding, and give-up (how investors buy in)

Every participant earns a base **BSSS %** of each venture through their work, and
together they earn the whole venture (share %s total 100). **Investors hold no
base** — they own equity *only by buying it*. In exchange for monthly cash drawn
from the VSC1 fund (**Funded $/mo**), a participant **gives up** a cut of the
shares they earn (**Gives up %**); those given-up shares are what the investors
own. A participant who draws no cash keeps everything they earn, and the
investors get nothing from them.

Each participant row has an editable **name**, **role**, **BSSS %**, **Funded
$/mo**, and **Gives up %**. The investor pool is then divided among individual
investors by **cohort share** (their contribution ÷ total raise).

Worked example — a participant with 35% BSSS gives up 35% of *that*: they keep
35% × 0.65 = **22.75%**, and the investors buy 35% × 0.35 = **12.25%**. The
give-up only moves *future* (unlocked) shares, matching BSSS's "locked slices
can't be diluted."

## Capital vs operational costs

Participants come in two cost categories — mechanically identical, accounted
separately:

- **Contributors → capital cost** (development). Defaults: Strategic Marketing
  30%, Engineering 20%, Product 15% — funded $0, gives up 0%.
- **Operations → operational cost** (overhead, e.g. running the studio).
  Default: Ministry of Product 35%, funded **$15k/mo**, gives up **35%**.

(35 + 30 + 20 + 15 = 100.) The **fund only depletes by what is actually drawn** —
contributor funding (capital) + operations funding (operational). There is no
flat operating budget; if nobody draws, the fund holds. The funding panel shows
the two running totals (**Capital spent** / **Operational spent**), and the cap
table groups holders under **Operational (overhead)**, **Capital (development)**,
and **Investors**, reporting each holder's equity value, **funded** cash drawn,
**distributions** (post-spinout profit), and total made.

Use **Edit Participants ✎** to add/remove contributors, operations entities, and
investors and tune every field; a live total shows how close the share %s are to
100.

## Controls

- **Add Investor** — commit more capital to VSC1 (recomputes cohort shares).
- **Fill VSC1** — top the cohort to its raise target and activate it.
- **Advance One Month** — pay out fund draws, maybe seed a new idea, advance/stall/kill
  ventures, fill BSSS slices, grow revenue, and re-check spinout eligibility.
- **Spinout Venture** — appears on a card once it is eligible.
- **Reset** — restore the initial sample cohort.

State is persisted to `localStorage` (`mop_venture_studio_v1`). No backend, no
auth, no build step.

## Run

Serve the repo root and open `venturestudio/index.html`:

```
npx serve .
# or
python3 -m http.server 8000
```

Spec: [`docs/Venture Studio Simulator.md`](../docs/Venture%20Studio%20Simulator.md).
