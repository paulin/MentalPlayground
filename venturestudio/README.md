# Venture Studio Simulator

A one-page, no-build web app that visually explains how the Ministry of Product
venture studio machine works. It is an **explanatory model, not a legal cap
table** — every ownership, revenue, and distribution number is simulated,
estimated, and illustrative.

## What it shows

- **The studio machine** — a funding tank for **VSC1** (Venture Studio Cohort 1)
  and a live money-flow diagram: investors fund the cohort → the cohort pays MoP
  a monthly operating budget → MoP turns money and focus into ventures.
- **The venture pipeline** — a funnel of ideas moving through the 10 BSSS release
  levels (RL1 Idea → RL10 Stable). Each venture card shows its stage, MRR,
  customers, ops load, cash-flow status, and a **BSSS donut** that fills as
  stages complete. Most ideas are expected to stall or be killed.
- **Spinout LLCs** — when a venture clears the spinout bar (MRR ≥ $5k, positive
  cash flow, repeatable acquisition, stable product, ≤10 mgmt hrs/week) it can be
  spun out. BSSS ownership converts into a formal ownership table, the LLC pays
  Operations a 10% stewardship fee, and estimated profit + investor distributions
  are shown.

## BSSS (Big Slice / Small Slice)

Each stage opens a **Big Slice** with a fixed percentage of the venture. A
contributor's **Small Slice** in that stage = their points ÷ total points in the
slice × the Big Slice %. Completed slices lock and can't be diluted. The donut
splits each filled wedge into investor (blue) and contributor (green) sub-arcs;
the active slice has a gold outline; planned future stages are gray (unallocated).

## Contributors, funding, and give-up

Each contributor earns a base **BSSS %** of every venture through their work. In
exchange for monthly cash from the VSC1 fund (**Funded $/mo**), a contributor can
**give up** a cut of the shares they earn — those shares pass to the investor
pool. So a contributor trades equity for salary-like cash; one who takes no fund
money keeps everything they earn.

Each contributor row has an editable **name**, **role**, **BSSS %**, **Funded
$/mo**, and **Gives up %**. Defaults: Strategic Marketing (30% BSSS), Engineering
(20%), Product (15%), against a 35% investor-pool base (35 + 30 + 20 + 15 = 100).
Blank fields are treated as zero.

Worked example — a contributor with 30% BSSS gives up 20% of *that*: they keep
30% × 0.80 = **24%**, and the fund gains 30% × 0.20 = **6%** (so the investor pool
rises from its 35% base to ~41%). The give-up only moves *future* (unlocked)
shares, matching BSSS's "locked slices can't be diluted."

The BSSS base percents (investor pool + contributor shares) are weights — keep
them near 100% for literal ownership. Use **Edit Participants ✎** to add/remove
contributors, operations entities, and investors and tune every field; a live
total shows how close the base is to 100%. The cap table then reports each
holder's equity value, **funded** cash, **distributions** (post-spinout profit +
fees), and total made.

## Operations

**Operations** is a separate top-level category, distinct from contributors.
Operations entities (default: Ministry of Product) charge a **monthly fee from
the VSC1 fund** (`feeMonthly`) and earn the **10% LLC stewardship fee** that
spun-out ventures pay each month. They do **not** receive BSSS equity shares —
they never appear in the ownership math for any venture or LLC.

Use **Edit Participants ✎** to add, rename, or remove operations entities and
adjust the monthly fee. The cap table shows their cumulative fund fees (Funded
column) and LLC stewardship fees (Distributions column) separately from equity.

## Controls

- **Add Investor** — commit more capital to VSC1 (recomputes cohort shares).
- **Fill VSC1** — top the cohort to its raise target and activate it.
- **Advance One Month** — pay MoP, maybe seed a new idea, advance/stall/kill
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
