# MJ VS Credit Pool Simulator

A single-page **teaching tool** built from
[`docs/mj_vs_credit_pool_simulator.md`](../docs/mj_vs_credit_pool_simulator.md).
Self-contained — open `index.html`, no build step.

It is not a game. It is a simulation that makes one idea obvious:

> Ownership is not guessed at the beginning. It is earned, documented, reviewed,
> and allocated as the venture becomes real.

## What it shows

A PortCo (**InboxOps AI**) advances through seven venture-studio phases —
Opportunity → Qualification → Validation → MVP Build → First Revenue → Scale →
Spinout. Each **event** does five things:

1. Adds a row to the **scorecard ledger**.
2. Raises a weighted **contribution category** score (evidence, not ownership).
3. Draws an **allocation** from one **economic pool** — never below zero.
4. Updates venture **metrics** (MRR, customers, CAC, certainty, estimated value).
5. Pushes the **milestone gate**; at 100 the venture advances a phase.

### Economic pools

| Pool | Default | Behaviour |
|---|---:|---|
| Studio Entity | 40% | Reserved — not drawn by events |
| Principal Contribution | 30% | Allocated dynamically |
| Contributor / Advisor | 10% | Allocated dynamically |
| Strategic / Fundraising | 10% | Allocated dynamically |
| Future Operator | 10% | Reserved until scale / spinout |

### Controls

- **Run Next Event** — play the next unlocked event for the current phase.
- **Auto Run 5 Events** — run five in sequence.
- **Force Milestone Review** — advance a phase manually.
- **Reset** — restore the starting state.
- **Export ledger (CSV)** — download the full scorecard.

At spinout a **Spinout Report** renders the ownership waterfall (reserved pools
at full weight, dynamic pools at what was earned, plus the unallocated
remainder), revenue, estimated value, certainty, and the strongest contribution
evidence.

## Notes

This is a model, not a valuation engine. `venture_value = MRR × 36 × (1 +
certainty/100)` is a visual proxy. All figures are illustrative.
