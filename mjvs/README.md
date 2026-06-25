# MJ Venture Studio

A single-player, turn-based **venture studio simulator**, built from
[`docs/mjvs.md`](../docs/mjvs.md) (Incumbent Failure Arbitrage Studio model).
Self-contained — open `index.html`, no build step.

You play a **Studio Principal**: find an incumbent's failure, validate the
customer pain, build a wedge product, win revenue, and spin out a PortCo — all
before you run out of **Cash** or **Runway**.

## How it plays

1. **Pick an archetype** — Builder, Operator, Rainmaker, Capitalist, or Venture
   Architect. Each boosts different contribution categories and tweaks your
   starting resources.
2. **Work the seven phases** — Opportunity Discovery → Qualification →
   Validation → MVP Build → Revenue Validation → Scale → Spinout. Each phase
   offers actions that spend **Cash** and **Runway (time)** and move
   **Reputation**, **Certainty**, pain signals, customers, and **MRR**.
3. **Clear each gate** — every phase has a requirement (e.g. Certainty ≥ 60 and
   3 pain signals to leave Validation; $45k MRR to leave Scale). Meet it to
   advance.
4. **Spin out** — finalize the PortCo to score your run, or fail out if you run
   dry first.

## Mechanics

- **Four resources** — Cash, Runway (weeks), Reputation (0–100), Certainty
  (0–100). Certainty has a soft cap: early conviction is cheap, the last points
  are hard-won.
- **Seven contribution categories** weighted as in the spec (Product 20%, GTM
  20%, Ops 15%, Partnerships 15%, Leadership 15%, Origination 10%, Fundraising
  5%). Ownership follows contribution; the weighted score feeds the outcome.
- **Random events** add texture and risk after some actions.
- **Six endgame outcomes** — Failed Venture, Zombie Startup, Lifestyle Business,
  Growth Company, Acquisition Target, and Venture Studio Champion — graded on
  revenue, contribution breadth, and reputation.

## Files

```
index.html   shell + intro/disclaimer
style.css    dark theme matching the rest of the playground
app.js       all game state, mechanics, scoring, and rendering (vanilla JS)
```

Everything is simulated and illustrative — a model of disciplined
venture-building, not financial advice.
