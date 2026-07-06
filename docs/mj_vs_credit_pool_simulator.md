# MJ VS Credit Pool Simulator
## One-Page Web App System Definition

Version 1.0

---

# Purpose

The MJ VS Credit Pool Simulator is a one-page web application that visually models how contribution credit is allocated across a venture studio PortCo over time.

It is not a game in the traditional sense. It is a simulation and teaching tool.

The simulator should show how a startup moves through venture studio milestones, how events create scorecard evidence, how contribution categories are scored, and how economic participation is drawn from predefined ownership pools.

The core question the simulator answers is:

> As a PortCo develops, who earns what, from which pool, and why?

---

# Conceptual Model

The simulator is based on a dynamic contribution-based equity framework.

The system assumes that equity should not be granted through a static founder split. Instead, participation should accrue to the people or groups that measurably increase the value, success probability, revenue potential, defensibility, or exit optionality of the PortCo.

The simulator should make this visible by showing:

1. Venture phases over time
2. Startup events
3. Scorecard updates
4. Pool drawdowns
5. Remaining unallocated value
6. Accumulated contribution credit
7. Final allocation at spinout

---

# Core User Experience

The user opens a single-page web app and sees:

- A phase timeline
- A current startup card
- Economic pool balances
- Contribution category scores
- A scorecard ledger
- Recent startup events
- Venture metrics such as MRR, customers, certainty, and estimated value

The user can press buttons to advance the simulation:

- Run Next Event
- Auto Run Multiple Events
- Force Milestone Review
- Reset Simulation

Each event updates the venture and may allocate credit from one or more economic pools.

---

# Primary Simulation Flow

The startup progresses through seven phases:

1. Opportunity Discovery
2. Qualification
3. Validation
4. MVP Build
5. Revenue Validation
6. Scale
7. Spinout

Each phase has a milestone gate.

Events generate evidence. Evidence increases milestone progress. When milestone progress reaches 100, the venture advances to the next phase.

---

# Phase Definitions

## Phase 1: Opportunity Discovery

Purpose:

Identify a real customer pain caused by incumbent failure.

Example events:

- Incumbent pain mapped
- Customer interviews confirm urgency
- Competitive gap discovered
- Market pain proves too weak

Primary contribution categories:

- Venture Origination
- Pain Validation
- Leadership

---

## Phase 2: Qualification

Purpose:

Decide whether the venture deserves studio resources.

Example events:

- Synthetic diligence memo completed
- CAC assumptions challenged
- Market size revised
- Revenue model improved
- Qualification score fails threshold

Primary contribution categories:

- Leadership
- Venture Origination
- GTM
- Strategic Analysis

---

## Phase 3: Validation

Purpose:

Prove that customers care and may pay.

Example events:

- LOIs signed
- Paid pilot secured
- Customer interview batch completed
- Buying committee validated
- Customer pain proves non-urgent

Primary contribution categories:

- GTM
- Origination
- Customer Acquisition
- Partnerships

---

## Phase 4: MVP Build

Purpose:

Build the first useful wedge product.

Example events:

- MVP shipped
- AI workflow implemented
- Integration completed
- Technical debt discovered
- Product onboarding improved

Primary contribution categories:

- Product & Engineering
- Operations
- Leadership

---

## Phase 5: Revenue Validation

Purpose:

Generate paying customers and validate willingness to pay.

Example events:

- First paying customers onboarded
- Pricing accepted
- Delivery workflow stabilized
- Churn event occurs
- Customer support burden increases

Primary contribution categories:

- GTM
- Operations
- Product
- Leadership

---

## Phase 6: Scale

Purpose:

Show repeatable growth and operational leverage.

Example events:

- Paid acquisition CAC lands below target
- Channel partner opens distribution
- Strategic investor commits capital
- Repeatable sales motion created
- Operations bottleneck appears

Primary contribution categories:

- GTM
- Strategic Partnerships
- Fundraising
- Operations

---

## Phase 7: Spinout

Purpose:

Finalize allocation and prepare PortCo structure.

Example events:

- Spinout allocation review completed
- Profit interest grants generated
- Future operator pool reserved
- Acquisition interest appears
- LLC conversion path selected

Primary contribution categories:

- Leadership
- Governance
- Strategic Partnerships
- Operations

---

# Economic Pools

The simulator should use the following default ownership pools.

## Studio Entity Pool

Default size: 40%

Purpose:

Represents baseline studio ownership for originating the platform, governance, shared resources, methodology, tools, and ongoing support.

Behavior:

This pool is usually locked and not drawn down by contribution events.

---

## Principal Contribution Pool

Default size: 30%

Purpose:

Allocated dynamically to studio principals based on actual contribution.

Examples:

- Product leadership
- GTM execution
- Operations management
- Venture leadership
- Technical execution
- Customer acquisition

Behavior:

Events can allocate credit from this pool.

---

## Contributor / Advisor Pool

Default size: 10%

Purpose:

Reserved for non-principal contributors, advisors, specialists, fractional operators, and key builders.

Examples:

- Advisor validates buyer need
- Designer creates onboarding UX
- Domain expert shapes product
- Contractor materially improves launch

Behavior:

Events can allocate credit from this pool.

---

## Strategic Partnership / Fundraising Pool

Default size: 10%

Purpose:

Reserved for strategic partnerships, capital formation, distribution leverage, acquisition pathways, and high-value introductions.

Examples:

- Channel partner secured
- Strategic investor commits capital
- Acquisition conversation created
- Technology integration partner closed

Behavior:

Events can allocate credit from this pool.

---

## Future Employee / Operator Pool

Default size: 10%

Purpose:

Reserved for future hires, operators, executives, or employees if the PortCo scales.

Behavior:

Usually reserved until spinout or scale stage. It may be shown as locked or reserved.

---

# Contribution Categories

The simulator should track seven weighted contribution categories.

## Venture Origination & Pain Validation

Weight: 10%

Tracks:

- Identifying incumbent failure
- Validating urgency
- Proving willingness to pay
- Defining the initial wedge

---

## Product & Engineering Execution

Weight: 20%

Tracks:

- MVP architecture
- Software development
- AI workflow design
- Infrastructure
- Integrations
- Technical quality

---

## GTM, Marketing & Customer Acquisition

Weight: 20%

Tracks:

- ICP definition
- Positioning
- Sales motion
- Campaigns
- Paid conversion
- Customer acquisition
- Retention

---

## Operations & Delivery

Weight: 15%

Tracks:

- Delivery systems
- Customer support
- Vendor coordination
- QA
- Documentation
- Operating cadence

---

## Strategic Partnerships & Corp Dev

Weight: 15%

Tracks:

- Revenue partnerships
- Distribution relationships
- Acquisition pathways
- Integration partners
- Strategic leverage

---

## Fundraising & Capital Formation

Weight: 5%

Tracks:

- Investor introductions
- Fundraising materials
- Investor process
- Capital close
- Strategic capital

---

## Leadership, Governance & Venture Management

Weight: 15%

Tracks:

- Decision-making
- Accountability
- Milestone discipline
- Contributor management
- Conflict resolution
- Killing bad ideas quickly

---

# Event Model

Each simulation event should contain the following fields:

```json
{
  "id": "event_001",
  "phase": 0,
  "title": "Customer interviews confirm urgency",
  "description": "Five target customers describe the same workflow pain and confirm willingness to pay.",
  "pool": "principal",
  "category": "origination",
  "score": 5,
  "allocation": 2.2,
  "mrrDelta": 0,
  "customerDelta": 0,
  "certaintyDelta": 18,
  "gateDelta": 35,
  "valueDelta": 0,
  "sentiment": "positive"
}
```

---

# Event Resolution

When an event is run:

1. Add the event to the event feed.
2. Add a row to the contribution ledger.
3. Increase the relevant contribution category score.
4. Allocate credit from the relevant pool.
5. Reduce the remaining value in that pool.
6. Update startup metrics.
7. Update milestone gate progress.
8. If gate progress reaches 100, advance to the next phase.

---

# Pool Allocation Logic

Each event may allocate a percentage from one pool.

Formula:

```text
actual_allocation = min(event.allocation, pool.remaining)
pool.remaining = pool.remaining - actual_allocation
```

The simulator should never allow a pool to drop below zero.

If a pool is exhausted, future allocations from that pool should either:

- allocate zero, or
- show as blocked / unavailable

For the first version, allocate zero once exhausted.

---

# Category Score Logic

Each event has a score from 0 to 5.

Suggested conversion:

```text
category_score += event.score * 8
category_score = min(category_score, 100)
```

This creates a visible category progress bar.

The category score is not the same as ownership. It represents accumulated contribution evidence in that category.

---

# Milestone Gate Logic

Each phase has a gate progress value from 0 to 100.

Events update the gate:

```text
gate_progress += event.gateDelta
gate_progress = clamp(gate_progress, 0, 100)
```

When gate progress reaches 100:

```text
phase += 1
gate_progress = 0
```

---

# Startup Metrics

The simulator should track these venture metrics:

## MRR

Monthly recurring revenue.

Updated by revenue events.

## Customers

Number of paying customers.

Updated by customer acquisition events.

## CAC

Customer acquisition cost.

Starts high and improves as GTM events succeed.

Suggested starting value:

```text
CAC = 120
```

When customer acquisition succeeds:

```text
CAC = max(12, CAC * 0.92)
```

## Certainty

Represents how much the studio understands the opportunity.

Starts at:

```text
20%
```

Improves through research, validation, customer discovery, and revenue evidence.

Can decrease when bad assumptions are discovered.

## Venture Value

Estimated venture value.

Simple formula for first version:

```text
venture_value = MRR * 36 * (1 + certainty / 100)
```

This is not intended to be a real valuation model. It is a visual proxy.

---

# Default Event Deck

The simulator should ship with a default sequence of events.

## Opportunity Events

1. Incumbent pain mapped
   - Pool: Principal
   - Category: Origination
   - Score: 4
   - Allocation: 1.8%
   - Certainty: +12
   - Gate: +25

2. Customer interviews confirm urgency
   - Pool: Principal
   - Category: Origination
   - Score: 5
   - Allocation: 2.2%
   - Certainty: +18
   - Gate: +35

## Qualification Events

3. Synthetic diligence memo flags weak CAC assumptions
   - Pool: Principal
   - Category: Leadership
   - Score: 3
   - Allocation: 1.0%
   - Certainty: +10
   - Gate: +18
   - Sentiment: Negative / caution

4. Revenue model revised with better pricing
   - Pool: Principal
   - Category: Leadership
   - Score: 4
   - Allocation: 1.7%
   - Certainty: +12
   - Gate: +25

## Validation Events

5. Three LOIs signed
   - Pool: Contributor / Advisor
   - Category: GTM
   - Score: 4
   - Allocation: 1.5%
   - Certainty: +16
   - Gate: +35

6. Advisor validates buying committee
   - Pool: Contributor / Advisor
   - Category: Origination
   - Score: 3
   - Allocation: 0.8%
   - Certainty: +12
   - Gate: +20

## MVP Build Events

7. MVP shipped with AI routing workflow
   - Pool: Principal
   - Category: Product & Engineering
   - Score: 5
   - Allocation: 3.4%
   - Certainty: +8
   - Gate: +40

8. Technical debt discovered in integration layer
   - Pool: Principal
   - Category: Product & Engineering
   - Score: 2
   - Allocation: 0.7%
   - Certainty: -4
   - Gate: -10
   - Sentiment: Negative

## Revenue Validation Events

9. First 10 paying customers onboarded
   - Pool: Principal
   - Category: GTM
   - Score: 5
   - Allocation: 3.0%
   - MRR: +1000
   - Customers: +10
   - Certainty: +14
   - Gate: +35

10. Delivery workflow stabilized
   - Pool: Principal
   - Category: Operations
   - Score: 4
   - Allocation: 2.0%
   - MRR: +500
   - Customers: +5
   - Certainty: +8
   - Gate: +20

## Scale Events

11. Channel partner opens distribution path
   - Pool: Strategic / Fundraising
   - Category: Partnerships
   - Score: 5
   - Allocation: 3.0%
   - MRR: +2500
   - Customers: +40
   - Certainty: +10
   - Gate: +30

12. Paid acquisition CAC lands below target
   - Pool: Principal
   - Category: GTM
   - Score: 5
   - Allocation: 3.3%
   - MRR: +4000
   - Customers: +80
   - Certainty: +14
   - Gate: +35

13. Strategic investor commits capital
   - Pool: Strategic / Fundraising
   - Category: Fundraising
   - Score: 5
   - Allocation: 2.0%
   - Certainty: +5
   - Gate: +20

## Spinout Events

14. Spinout allocation review completed
   - Pool: Principal
   - Category: Leadership
   - Score: 5
   - Allocation: 2.4%
   - Certainty: +5
   - Gate: +25

15. Future operator pool reserved for CEO hire
   - Pool: Future Operator
   - Category: Operations
   - Score: 3
   - Allocation: 0%
   - Gate: +10

---

# Ledger Requirements

The scorecard ledger should show one row per event.

Columns:

- Event
- Pool
- Category
- Score
- Allocation
- Remaining Pool

Example:

| Event | Pool | Category | Score | Allocation | Remaining Pool |
|---|---|---|---:|---:|---:|
| Customer interviews confirm urgency | Principal Contribution | Origination | 5/5 | 2.2% | 26.0% |

---

# UI Layout

The app should be a single page.

## Header

Display:

- MJ VS title
- Current phase
- MRR
- Customers
- Venture value
- Reset button

## Main Left Column

Display:

1. Simulation purpose
2. Phase timeline
3. Startup card
4. Milestone gate
5. Scorecard ledger

## Right Column

Display:

1. Economic pools
2. Contribution category scores
3. Ownership allocated summary
4. Recent events feed

---

# Visual Requirements

The simulator should feel like a clean venture studio dashboard.

Style:

- White cards
- Light gray background
- Dark header
- Rounded corners
- Progress bars
- Small status badges
- Simple tables
- Clear hierarchy

Use calm, businesslike colors:

- Blue for progress
- Green for successful allocation
- Amber for reserved pools
- Red for negative events

---

# Controls

## Run Next Event

Runs the next available event for the current or completed phase.

## Auto Run 5 Events

Runs five events in sequence.

## Force Milestone Review

Advances to the next phase manually.

## Reset

Restores the simulation to the starting state.

---

# Implementation Notes

The first version should be implemented as a single HTML file with embedded CSS and JavaScript.

No backend is required.

No login is required.

No framework is required.

All simulation data can be stored in local JavaScript arrays and objects.

Optional:

- Store simulation state in localStorage
- Allow editing pool percentages
- Allow adding custom events
- Allow exporting ledger as CSV
- Allow multiple contributor names
- Allow final ownership waterfall

---

# Future Enhancements

## Editable Pool Architecture

Allow the user to change default pool percentages.

## Named Contributors

Instead of generic pools, allow allocations to specific people:

- Principal A
- Principal B
- Advisor C
- Contributor D

## Attribution Splits

Allow one event to allocate across multiple contributors:

```json
"attribution": [
  {"name": "Michael", "share": 0.6},
  {"name": "Nicole", "share": 0.4}
]
```

## Multiple PortCos

Allow several ventures to run in parallel.

## Scenario Templates

Examples:

- Lifestyle SaaS
- Acquisition-target wedge
- Services-to-software product
- Strategic partnership-led venture
- AI agent workflow product

## Final Spinout Report

Generate a final summary showing:

- Total allocated by pool
- Remaining pool value
- Contribution by category
- Revenue at spinout
- Estimated value
- Suggested ownership structure

---

# Success Criteria

The simulator is successful if a viewer can understand:

1. The venture does not receive ownership allocation all at once.
2. Credit is allocated over time as evidence appears.
3. Different types of value draw from different pools.
4. The scorecard creates transparency.
5. Pools can be depleted.
6. Revenue, certainty, and strategic leverage increase venture value.
7. The final ownership structure emerges from contribution rather than static entitlement.

---

# Core Message

MJ VS Credit Pool Simulator should make one idea obvious:

> Ownership is not guessed at the beginning. It is earned, documented, reviewed, and allocated as the venture becomes real.
