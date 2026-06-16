---
layout: post
title: "The Venture Studio Simulator: watch a fund become a portfolio of companies"
date: 2026-06-16
categories: [simulations, product]
tags: [venture-studio, bsss, ownership, ministry-of-product, javascript]
excerpt: >-
  A one-page, no-build interactive model of how a venture studio turns a single
  fund into a portfolio of companies — investors, contributors, operations, BSSS
  ownership, and spinouts, all visible as you click through the months.
---

Most explanations of how a venture studio works are slide decks full of arrows.
You read "investors fund the studio, the studio builds companies, the winners
spin out" and nod along — but you never actually *see* the money move, the
ownership fill in, or the funnel thin out. The **Venture Studio Simulator** is an
attempt to fix that: a single web page where you press **Advance One Month** and
watch the whole machine run.

It's part of [Mental Playground](https://github.com/), a collection of small,
self-contained apps built to make ideas you can usually only read about into
things you can watch happen. This one models the **Ministry of Product** venture
studio.

> **It's an explanatory model, not a legal cap table.** Every ownership, revenue,
> and distribution number in it is *simulated, estimated, and illustrative*. The
> point is to make the flow understandable, not to be financially exact.

---

## What it's modelling

A **venture studio** isn't a fund that writes checks into other people's
startups. It's an operating company that *builds* startups itself — generating
ideas, staffing them, launching them, and spinning out the ones that work as
their own companies. Investors back the studio's **cohort** (a year of focused
venture creation) rather than a single bet, so they get exposure to a whole
portfolio.

The simulator references three real ideas:

- **The cohort fund — "VSC1" (Venture Studio Cohort 1).** A pool of investor
  capital with a raise target (default **$300,000**) that funds one year of work.
- **The product pathway.** Ventures progress through ten "release levels," from
  **RL1 Idea** to **RL10 Stable**. Each level is a milestone.
- **BSSS — "Big Slice / Small Slice."** The ownership model that decides who owns
  how much of each venture, and how that ownership is *earned* over time rather
  than handed out up front.

Let's walk through how those fit together.

---

## The cast

**Investors** commit cash to the fund. In the simulator you can set the **raise
target** before you fill the fund, add investors, and see each one's *cohort
share* — their contribution divided by the total raise. (Investor 3 putting in
$150k of a $300k raise owns 50% of the cohort.)

**Participants** are the people and entities that actually do the work and earn
ownership. They come in two flavours that behave *identically* but are accounted
separately:

- **Contributors** — the builders (engineering, product, marketing). Their
  funding is a **capital cost** (development).
- **Operations** — the studio overhead, e.g. Ministry of Product itself running
  the machine. Its funding is an **operational cost**.

Every participant earns a share of each venture through work, and every
participant can be paid monthly cash out of the fund. The interesting part is
what they give up for that cash.

---

## How ownership is earned: BSSS

BSSS stands for **Big Slice / Small Slice**.

- A **Big Slice** is a fixed chunk of a venture's ownership attached to a
  milestone. Each of the ten product-pathway stages opens a Big Slice with a
  fixed percentage. They add up to 100%:

  | Stage | Name | Big Slice |
  |------|------|----------:|
  | RL1 | Idea | 4% |
  | RL2 | Vision | 4% |
  | RL3 | Prototype | 4% |
  | RL4 | Play Test | 12% |
  | RL5 | Release | 16% |
  | RL6 | Users | 12% |
  | RL7 | Audience | 12% |
  | RL8 | Monetized | 12% |
  | RL9 | Scalable | 12% |
  | RL10 | Stable | 12% |

- A **Small Slice** is a contributor's earned share *inside* a Big Slice,
  proportional to the work (points) they put in:

  ```
  Small Slice % = (your points / total points in the slice) × Big Slice %
  ```

- **Completed slices lock.** Once a stage is done, the ownership earned inside it
  can't be diluted later. Future stages stay unallocated until the work happens —
  which is why a young venture's ownership donut is mostly grey.

So ownership isn't granted on day one; it *fills in* as a venture climbs the
pathway. The BSSS donut on each venture card shows exactly this: coloured wedges
for what's been earned, grey for the future, and a number in the middle for how
much of the venture is spoken for so far.

---

## The twist: investors *buy* their equity

Here's the mechanic that makes the model click, and the part most cap-table
diagrams gloss over.

**Investors don't get equity for free.** The participants earn 100% of every
venture through their work. Investors only end up owning a venture because
participants *sell them shares* — and the currency is the fund.

Each participant has two dials:

- **Funded $/mo** — how much cash they draw from the fund each month.
- **Gives up %** — the cut of the shares they earn that they hand to the investor
  pool in exchange for that cash.

Take the default Operations entity, Ministry of Product: it earns a **35%** BSSS
share, draws **$15,000/month**, and **gives up 35%** of what it earns. So of its
35% it keeps `35% × (1 − 0.35) = 22.75%`, and the investors buy
`35% × 0.35 = 12.25%`. That 12.25% then splits among the individual investors by
their cohort share.

A participant who takes **no** money keeps **everything** they earn — and the
investors get nothing from them. Which leads to the cleanest one-line summary of
the whole economic model:

> **Take the fund's cash, give up equity. Bootstrap, keep your equity.**

And because investors' ownership is *only* the shares people sold them, the fund
behaves accordingly: **it only drains when someone actually draws funding.** If
nobody takes money this month, the tank doesn't move and the investors gain
nothing. Press Advance and you'll see the fund tank visibly drop by exactly what
was drawn, with a little "−$15,000" cue floating off the top.

---

## Capital vs operational cost

Both contributor and operations funding come out of the same fund, but the
simulator tracks them as two separate running totals — **Capital spent**
(development) and **Operational spent** (overhead) — and the cap table groups
holders the same way. It's a small distinction that mirrors how a real studio
thinks about its burn: the money spent *building product* is a different line
from the money spent *running the studio*.

---

## The monthly machine

The heart of the app is the **Advance One Month** button. Each month:

1. The fund pays out whatever participants draw (capital + operational). The tank
   drains.
2. A new idea may enter the pipeline.
3. Ventures advance a stage, stall, or get **killed** — most ideas fail, and
   killing weak bets is how the studio concentrates focus.
4. BSSS slices fill as work is allocated.
5. Surviving ventures grow customers and revenue.
6. Ventures are re-checked for spinout eligibility.

The **Pipeline funnel** visualises this as a left-to-right shape across the ten
stages: wide on the left where ideas enter, narrowing to the right as they're
selected or killed, with chips for each venture sitting at its current stage and
an exit at the far end for the ones that graduate. It's deliberately a *funnel*,
not three tidy bets — the whole premise is throughput and attrition.

---

## Spinouts

A venture becomes eligible to spin out into its own company when it clears five
bars:

- **MRR ≥ $5,000**
- **Positive cash flow**
- **Repeatable customer acquisition**
- **A stable product**
- **≤ 10 hours/week** of management

That last one matters: a company can't spin out if it still needs constant
babysitting. The $5k MRR threshold isn't the *goal* — it's the point where a
venture is real enough to become a formal operating company. (The studio is
fishing for ventures that could plausibly reach ~10,000 customers at ~$15/month,
i.e. ~$150k MRR — that's the "target shape," not a promise.)

When you click **Spinout Venture**, its BSSS ownership *freezes* into a formal
cap table, it becomes an **LLC**, and it starts tracking real monthly economics:
revenue, operating cost, and profit distributed to owners by their stake. An
illustrative valuation (roughly **5× ARR**) lets the cap table put a paper value
on everyone's holdings.

---

## The cap table

The bottom of the app pulls it all together into a **simulated cap table** that
answers "who owns what, and how much has everyone actually made?" For each holder
it shows:

- **Equity value** — the paper value of their BSSS stakes (ownership × venture
  valuation).
- **Funded** — cumulative cash they've drawn from the fund.
- **Distributions** — profit paid out to them from spun-out LLCs.
- **Total made** — the sum of the three.

Holders are grouped into **Operational (overhead)**, **Capital (development)**,
and **Investors**, so you can see the three sides of the deal at a glance.

---

## What's deliberately simplified

It's a teaching model, so it cuts corners on purpose:

- Venture success is driven by a hidden "quality" roll, not a real market.
- Valuations are a flat ARR multiple, not a real comp.
- The give-up percentages and funding amounts are knobs you set, not negotiated
  outcomes.
- Everything is labelled *simulated / illustrative* for a reason.

The goal, in the project's own words, is to **make the flow understandable before
making it accurate.**

---

## Under the hood

The whole thing is intentionally low-tech: a single page of **vanilla
JavaScript**, no build step, no framework, no backend. State lives in
`localStorage`, the ownership donuts are hand-drawn **SVG**, and the funnel and
fund tank are plain CSS. You can serve the repo and open it directly.

A few touches worth calling out for the curious:

- **Editable raise target**, which locks once you fill the fund (along with the
  investor roster) — with a "Fund is filled" indicator.
- **Save / load participants as CSV**, so you can craft a scenario and reload it.
- **Collapsible detail sections** so you can explore one thing at a time.
- **Rollovers and "ⓘ" explainers on nearly everything** — hover any stat,
  graphic, or label to get a plain-English description of what it means.

---

## Try it

The best way to understand a venture studio is to run one for sixty seconds:

1. **Set the raise target** (or leave it at $300k) and **Fill Fund**.
2. **Advance One Month** a dozen times and watch the funnel fill, the fund drain,
   and ownership donuts colour in.
3. Open **Edit Participants** and give a contributor a funding deal — say
   $8k/month for 40% of their shares — then advance again and watch the investors'
   stake grow as the capital spend climbs.
4. When a venture card turns green, **Spin it out** and see its ownership freeze
   into the cap table.
5. Hover the **ⓘ** icons and graphics whenever you're not sure what something is.

By the end you'll have a feel for the thing the model is really trying to teach:
a venture studio is a portfolio machine, most ideas are supposed to fail, and the
scarce resource the investment actually buys is **focus**.
