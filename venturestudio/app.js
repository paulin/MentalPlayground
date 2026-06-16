/* Venture Studio Simulator
 * An explanatory model of how the Ministry of Product venture studio machine works.
 * All ownership shown is SIMULATED / ILLUSTRATIVE — not a legal cap table.
 */
(function () {
  "use strict";

  // ---------------------------------------------------------------- Constants
  const STORAGE_KEY = "mop_venture_studio_v1";

  const VSC1_DEFAULTS = {
    raiseTarget: 300000,
    durationMonths: 12,
    monthlyOperatingBudget: 25000,
    targetSpinouts: 3,
    investorPoolPercent: 35,
    mopPoolPercent: 40,
    contributorPoolPercent: 25,
  };

  const STAGES = [
    { id: "RL1", name: "Idea", slicePercent: 4 },
    { id: "RL2", name: "Vision", slicePercent: 4 },
    { id: "RL3", name: "Prototype", slicePercent: 4 },
    { id: "RL4", name: "Play Test", slicePercent: 12 },
    { id: "RL5", name: "Release", slicePercent: 16 },
    { id: "RL6", name: "Users", slicePercent: 12 },
    { id: "RL7", name: "Audience", slicePercent: 12 },
    { id: "RL8", name: "Monetized", slicePercent: 12 },
    { id: "RL9", name: "Scalable", slicePercent: 12 },
    { id: "RL10", name: "Stable", slicePercent: 12 },
  ];
  console.assert(
    STAGES.reduce((s, st) => s + st.slicePercent, 0) === 100,
    "Stage slices must total 100%"
  );

  const TARGET_VENTURE_SHAPE = {
    targetCustomers: 10000,
    targetPricePerMonth: 15,
    targetMRR: 150000,
    targetARR: 1800000,
  };

  // Illustrative valuation: a venture is worth ~5x its annual recurring revenue.
  const VALUATION_ARR_MULTIPLE = 5;

  // Ownership group colors (per spec).
  const COLORS = {
    investor: "#4f8cff", // blue
    mop: "#9a6bff",      // purple
    contributor: "#4fc46b", // green
    unallocated: "#3a4052", // gray
    active: "#c8a83c",   // gold (outline)
  };

  const IDEA_NAMES = [
    "Ledgerly", "Cohortix", "Brightwork", "Tideline", "Quartzly", "Mapwise",
    "Outpace", "Foldspace", "Nestwork", "Cadence", "Pathwright", "Northbeam",
    "Quanta", "Hearthly", "Slipstream",
  ];

  // ------------------------------------------------------------------ Helpers
  let _id = 0;
  function generateId(prefix) { return (prefix || "id") + "_" + (++_id) + "_" + Math.floor(Math.random() * 1e6); }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function fmtMoney(n) {
    n = Math.round(n);
    return "$" + n.toLocaleString("en-US");
  }
  function fmtPct(n) { return n.toFixed(1) + "%"; }
  function stageIndex(id) { return STAGES.findIndex((s) => s.id === id); }

  // ------------------------------------------------------------- Slice / BSSS
  function createDefaultSlices() {
    return STAGES.map((s, i) => ({
      id: s.id,
      releaseLevel: s.id,
      name: s.name,
      slicePercent: s.slicePercent,
      status: i === 0 ? "active" : "planned", // planned | active | completed
      locked: false,
      points: {}, // participantId -> points
    }));
  }

  function calculateSmallSlice(contributorPoints, totalSlicePoints, bigSlicePercent) {
    if (totalSlicePoints === 0) return 0;
    return (contributorPoints / totalSlicePoints) * bigSlicePercent;
  }

  // Ownership earned by one group ("investor" | "mop" | "contributor") across all
  // active+completed slices. Planned slices are unallocated future ownership.
  function groupOwnership(venture, group) {
    return venture.slices.reduce((total, slice) => {
      if (slice.status === "planned") return total;
      const totalPts = Object.values(slice.points).reduce((a, b) => a + b, 0);
      if (totalPts === 0) return total;
      let groupPts = 0;
      for (const pid in slice.points) {
        if (participantGroup(pid) === group) groupPts += slice.points[pid];
      }
      return total + calculateSmallSlice(groupPts, totalPts, slice.slicePercent);
    }, 0);
  }

  function allocatedPercent(venture) {
    // Sum of slicePercent for active + completed slices (stages that have opened).
    return venture.slices.reduce(
      (t, s) => t + (s.status === "planned" ? 0 : s.slicePercent),
      0
    );
  }

  // Ownership actually earned so far (points have been allocated). An active slice
  // that just opened with no points yet is still unallocated.
  function earnedOwnership(venture) {
    return groupOwnership(venture, "investor") +
      groupOwnership(venture, "mop") +
      groupOwnership(venture, "contributor");
  }

  // Map a participant id to an ownership group. Steward-role contributors count
  // as the MoP/steward portion; everyone else is a contributor.
  let stewardSet = new Set();
  function refreshStewardSet() {
    stewardSet = new Set((state && state.contributors ? state.contributors : [])
      .filter((c) => c.role === "steward").map((c) => c.id));
  }
  function participantGroup(pid) {
    if (pid === "investor_pool") return "investor";
    if (pid === "mop" || pid === "steward" || stewardSet.has(pid)) return "mop";
    return "contributor";
  }

  // --------------------------------------------------------------- App state
  function makeInitialState() {
    _id = 0;
    const state = {
      currentMonth: 0,
      lastTransfer: 0,
      vsc1: {
        name: "VSC1",
        raiseTarget: VSC1_DEFAULTS.raiseTarget,
        fundedAmount: 0,
        remainingCapital: 0,
        durationMonths: VSC1_DEFAULTS.durationMonths,
        monthlyOperatingBudget: VSC1_DEFAULTS.monthlyOperatingBudget,
        targetSpinouts: VSC1_DEFAULTS.targetSpinouts,
        investorPoolPercent: VSC1_DEFAULTS.investorPoolPercent,
        status: "fundraising", // fundraising | active | complete
      },
      mop: { name: "Ministry of Product", monthlyRevenueFromCohort: 0, totalReceived: 0 },
      investors: [
        { id: "mj", name: "Investor 1", contributionAmount: 50000, cohortShare: 0 },
        { id: "investor2", name: "Investor 2", contributionAmount: 100000, cohortShare: 0 },
        { id: "investor3", name: "Investor 3", contributionAmount: 150000, cohortShare: 0 },
      ],
      contributors: [
        { id: "matt", name: "Matt Paulin", role: "steward", pointsEarned: 0 },
        { id: "kevin", name: "Kevin", role: "engineer", pointsEarned: 0 },
        { id: "adam", name: "Adam", role: "product_developer", pointsEarned: 0 },
      ],
      ventures: [
        addVenture("TrueUp"),
        addVenture("Real Estate Idea"),
        addVenture("Venture C"),
      ],
      spinouts: [],
      ideaPointer: 0,
      log: [],
      earnings: {}, // participantId -> cumulative realized cash
    };
    recomputeCohortShares(state);
    return state;
  }

  function addVenture(name) {
    return {
      id: generateId("v"),
      name,
      stage: "RL1",
      status: "idea", // idea | active | stalled | killed | spun_out
      mrr: 0,
      customers: 0,
      pricePerCustomer: TARGET_VENTURE_SHAPE.targetPricePerMonth,
      opsHoursPerWeek: 40,
      cashFlowPositive: false,
      hasRepeatableAcquisition: false,
      productStable: false,
      operatingExpenses: 0,
      slices: createDefaultSlices(),
      spinoutEligible: false,
      // hidden simulation knobs
      quality: rand(0.35, 1.0),
      stalledMonths: 0,
      killReason: null,
    };
  }

  function recomputeCohortShares(state) {
    const total = state.investors.reduce((s, i) => s + i.contributionAmount, 0) || 1;
    state.investors.forEach((i) => { i.cohortShare = i.contributionAmount / total; });
  }

  // ------------------------------------------------------------ Funding logic
  function fillVSC1(state) {
    const total = state.investors.reduce((s, i) => s + i.contributionAmount, 0);
    state.vsc1.fundedAmount = Math.max(total, state.vsc1.raiseTarget);
    if (total < state.vsc1.raiseTarget) {
      // top the cohort up to target with an "open allocation" investor
      const gap = state.vsc1.raiseTarget - total;
      state.investors.push({ id: generateId("inv"), name: "Open Allocation", contributionAmount: gap, cohortShare: 0 });
    }
    state.vsc1.fundedAmount = state.investors.reduce((s, i) => s + i.contributionAmount, 0);
    state.vsc1.remainingCapital = state.vsc1.fundedAmount;
    state.vsc1.status = "active";
    recomputeCohortShares(state);
    pushLog(state, "VSC1 fully funded and activated — the studio can now focus.");
  }

  function addInvestor(state, name, amount) {
    state.investors.push({ id: generateId("inv"), name, contributionAmount: amount, cohortShare: 0 });
    state.vsc1.fundedAmount = state.investors.reduce((s, i) => s + i.contributionAmount, 0);
    if (state.vsc1.status === "active") state.vsc1.remainingCapital += amount;
    recomputeCohortShares(state);
    pushLog(state, `${name} committed ${fmtMoney(amount)} to VSC1.`);
  }

  function calculateInvestorVentureOwnership(investorContribution, totalRaise, investorPoolPercent) {
    return (investorContribution / totalRaise) * investorPoolPercent;
  }

  // ----------------------------------------------------- Monthly studio logic
  function payMonthlyStudioBudget(state) {
    const amount = Math.min(state.vsc1.monthlyOperatingBudget, state.vsc1.remainingCapital);
    state.vsc1.remainingCapital -= amount;
    state.mop.monthlyRevenueFromCohort = amount;
    state.mop.totalReceived += amount;
    state.lastTransfer = amount;
    return amount;
  }

  function maybeAddNewIdea(state) {
    const active = state.ventures.filter((v) => v.status !== "killed" && v.status !== "spun_out");
    // Keep a funnel: add a new idea most months while there's runway and room.
    if (active.length < 7 && Math.random() < 0.75 && state.ideaPointer < IDEA_NAMES.length) {
      const name = IDEA_NAMES[state.ideaPointer++];
      state.ventures.push(addVenture(name));
      pushLog(state, `New idea entered the pipeline: ${name}.`);
    }
  }

  function allocateMonthlyPoints(venture, state) {
    const active = venture.slices.find((s) => s.status === "active");
    if (!active) return;
    // Steward (MoP) leads, contributors build, investor capital backs the work.
    const stewards = state.contributors.filter((c) => c.role === "steward");
    const perSteward = stewards.length ? 1000 / stewards.length : 0;
    stewards.forEach((c) => { addPoints(active, c.id, perSteward); c.pointsEarned += perSteward; });
    // distribute contributor points across non-steward contributors
    const contribs = state.contributors.filter((c) => c.role !== "steward");
    const per = contribs.length ? 500 / contribs.length : 0;
    contribs.forEach((c) => { addPoints(active, c.id, per); c.pointsEarned += per; });
    addPoints(active, "investor_pool", 500);
  }

  function addPoints(slice, pid, pts) {
    slice.points[pid] = (slice.points[pid] || 0) + pts;
  }

  function addEarnings(state, pid, amount) {
    if (!state.earnings) state.earnings = {};
    state.earnings[pid] = (state.earnings[pid] || 0) + amount;
  }

  // Pay out one month of a spun-out LLC's economics: stewardship fee to the MoP
  // entity, and the remaining profit to equity holders by ownership %.
  function distributeLLCEarnings(state, llc) {
    addEarnings(state, "mop_entity", llc.stewardshipFee);
    if (llc.profit > 0) {
      llc.ownership.forEach((o) => {
        if (!o.id) return; // skip the unallocated row
        addEarnings(state, o.id, llc.profit * (o.percent / 100));
      });
    }
  }

  function advanceVentureStage(venture) {
    const idx = stageIndex(venture.stage);
    const slice = venture.slices[idx];
    slice.status = "completed";
    slice.locked = true;
    if (idx + 1 < STAGES.length) {
      venture.stage = STAGES[idx + 1].id;
      venture.slices[idx + 1].status = "active";
    }
  }

  function applyMonthlyProgress(venture, state) {
    if (venture.status === "killed" || venture.status === "spun_out") return;
    if (venture.status === "idea") venture.status = "active";

    allocateMonthlyPoints(venture, state);

    const idx = stageIndex(venture.stage);
    const q = venture.quality;

    // Advancement gets harder at later stages; weak ideas stall and die.
    const advanceChance = clamp(0.45 + q * 0.4 - idx * 0.03, 0.08, 0.9);
    if (idx < STAGES.length - 1 && Math.random() < advanceChance) {
      advanceVentureStage(venture);
      venture.stalledMonths = 0;
    } else {
      venture.stalledMonths += 1;
      // Most ideas fail: low-quality ventures that keep stalling get killed.
      const killChance = (1 - q) * 0.25 + venture.stalledMonths * 0.05;
      if (idx < 4 && Math.random() < killChance) {
        venture.status = "killed";
        venture.killReason = idx <= 1
          ? "No conviction — failed to find a vision worth pursuing."
          : "Stalled before traction — capital redirected to stronger bets.";
        pushLog(state, `${venture.name} killed: ${venture.killReason}`);
        return;
      }
    }

    updateVentureRevenue(venture);
  }

  function updateVentureRevenue(venture) {
    const idx = stageIndex(venture.stage);

    // Customers begin around Release (RL5) and compound with quality.
    if (idx >= 4) {
      if (venture.customers === 0) venture.customers = Math.round(rand(20, 80) * venture.quality + 10);
      const growth = rand(0.25, 0.7) * venture.quality;
      venture.customers = Math.round(
        clamp(venture.customers * (1 + growth) + 25, 0, TARGET_VENTURE_SHAPE.targetCustomers)
      );
    }
    venture.mrr = calculateMRR(venture.customers, venture.pricePerCustomer);

    // Ops burden falls as the product matures and acquisition becomes repeatable.
    venture.opsHoursPerWeek = Math.round(clamp(40 - idx * 4 - venture.quality * 6, 4, 40));
    venture.operatingExpenses = Math.round(venture.mrr * 0.35 + 800);
    venture.cashFlowPositive = venture.mrr > venture.operatingExpenses;
    venture.hasRepeatableAcquisition = idx >= 6 && venture.customers > 200;
    venture.productStable = idx >= 7;

    venture.spinoutEligible = checkSpinoutEligibility(venture);
  }

  function calculateMRR(customers, pricePerCustomer) { return customers * pricePerCustomer; }

  function checkSpinoutEligibility(venture) {
    return (
      venture.status !== "killed" &&
      venture.status !== "spun_out" &&
      venture.mrr >= 5000 &&
      venture.cashFlowPositive === true &&
      venture.opsHoursPerWeek <= 10 &&
      venture.hasRepeatableAcquisition === true &&
      venture.productStable === true
    );
  }

  function advanceOneMonth(state) {
    if (state.vsc1.status === "fundraising") return;
    refreshStewardSet();
    state.currentMonth += 1;
    state.mop.monthlyRevenueFromCohort = 0;

    if (state.vsc1.remainingCapital > 0) {
      payMonthlyStudioBudget(state);
    } else if (state.vsc1.status !== "complete") {
      state.vsc1.status = "complete";
      pushLog(state, "VSC1 capital fully deployed — the cohort operating window has closed.");
    }

    maybeAddNewIdea(state);
    state.ventures.forEach((v) => applyMonthlyProgress(v, state));

    // grow revenue for spun-out LLCs, then pay out the month's economics
    state.spinouts.forEach((llc) => {
      llc.mrr = Math.round(llc.mrr * (1 + rand(0.02, 0.08)));
      recomputeLLCFinancials(llc, state);
      distributeLLCEarnings(state, llc);
    });
  }

  // -------------------------------------------------------------- Spinout
  function calculateFinalOwnership(venture, state) {
    const rows = [];
    const investorGroup = groupOwnership(venture, "investor");
    // each investor individually = cohort share of the investor pool
    state.investors.forEach((inv) => {
      const pct = inv.cohortShare * investorGroup;
      if (pct > 0) rows.push({ id: inv.id, name: inv.name, group: "investor", percent: pct });
    });
    // steward(s) and contributors individually
    state.contributors.forEach((c) => {
      const pct = participantOwnership(venture, c.id);
      if (pct > 0) {
        rows.push({
          id: c.id,
          name: c.name + (c.role === "steward" ? " (Steward)" : ""),
          group: c.role === "steward" ? "mop" : "contributor",
          percent: pct,
        });
      }
    });
    const unalloc = Math.max(0, 100 - rows.reduce((a, r) => a + r.percent, 0));
    if (unalloc > 0.05) rows.push({ id: null, name: "Unallocated (future work)", group: "unallocated", percent: unalloc });
    return rows;
  }

  function participantOwnership(venture, pid) {
    return venture.slices.reduce((total, slice) => {
      if (slice.status === "planned") return total;
      const totalPts = Object.values(slice.points).reduce((a, b) => a + b, 0);
      return total + calculateSmallSlice(slice.points[pid] || 0, totalPts, slice.slicePercent);
    }, 0);
  }

  function spinoutVenture(venture, state) {
    if (!checkSpinoutEligibility(venture)) throw new Error("Venture is not eligible for spinout");
    const ownership = calculateFinalOwnership(venture, state);
    const llc = {
      id: generateId("llc"),
      name: `${venture.name} LLC`,
      sourceVentureId: venture.id,
      sourceName: venture.name,
      monthCreated: state.currentMonth,
      ownership,
      mrr: venture.mrr,
      operatingExpenses: venture.operatingExpenses || 0,
      mopStewardshipFeePercent: 10,
      status: "active",
      profit: 0,
      stewardshipFee: 0,
      distributions: [],
    };
    recomputeLLCFinancials(llc, state);
    venture.status = "spun_out";
    state.spinouts.push(llc);
    pushLog(state, `${venture.name} spun out into ${llc.name} — BSSS ownership is now formal.`);
  }

  function calculateLLCProfit(revenue, operatingExpenses, stewardshipFeeFraction) {
    const stewardshipFee = revenue * stewardshipFeeFraction;
    return revenue - operatingExpenses - stewardshipFee;
  }

  function recomputeLLCFinancials(llc, state) {
    const feeFrac = llc.mopStewardshipFeePercent / 100;
    // operating expenses scale with revenue so older LLCs stay realistic
    llc.operatingExpenses = Math.round(llc.mrr * 0.35 + 800);
    llc.stewardshipFee = Math.round(llc.mrr * feeFrac);
    llc.profit = Math.round(calculateLLCProfit(llc.mrr, llc.operatingExpenses, feeFrac));
  }

  function pushLog(state, msg) {
    state.log.unshift({ month: state.currentMonth, msg });
    if (state.log.length > 40) state.log.pop();
  }

  // ---------------------------------------------------------- Persistence
  let state = load() || makeInitialState();

  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
  }
  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw);
      // bump id counter so new ids don't collide
      _id = 100000;
      if (!s.earnings) s.earnings = {};
      return s;
    } catch (e) { return null; }
  }
  function reset() {
    state = makeInitialState();
    save();
    render();
  }

  // =============================================================== RENDERING
  const app = document.getElementById("app");

  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  function render(pulse) {
    refreshStewardSet();
    app.innerHTML = "";
    app.appendChild(fundingAndMachineSection(pulse));
    app.appendChild(pipelineSection());
    app.appendChild(spinoutSection());
    app.appendChild(capTableSection());
    app.appendChild(logSection());
    app.appendChild(explainSection());
  }

  // ---- Section 1+2: Funding tank + monthly machine ----
  function fundingAndMachineSection(pulse) {
    const sec = el("div", "section");
    sec.appendChild(el("h2", null, "The Studio Machine"));
    sec.appendChild(el("p", "sub", "Investors fund the cohort. The cohort pays MoP to operate. MoP turns money and focus into ventures."));

    const grid = el("div", "top-grid");

    // --- Funding panel ---
    const fp = el("div", "panel");
    const v = state.vsc1;
    const pct = clamp(Math.round((v.fundedAmount / v.raiseTarget) * 100), 0, 100);
    const statusCls = v.status === "active" ? "active" : v.status === "complete" ? "complete" : "";

    const tankRow = el("div", "tank-row");
    const tank = el("div", "tank");
    tank.appendChild(el("div", "tank-cap", "target"));
    const fill = el("div", "tank-fill");
    fill.style.height = pct + "%";
    tank.appendChild(fill);
    tank.appendChild(el("div", "tank-pct", pct + "%"));
    tank.appendChild(el("div", "tank-base", "VSC1"));
    tankRow.appendChild(tank);

    const stats = el("div", "stats");
    const rows = [
      ["Cohort", v.name + ' <span class="status-pill ' + statusCls + '">' + v.status + "</span>"],
      ["Raise target", fmtMoney(v.raiseTarget)],
      ["Funded", fmtMoney(v.fundedAmount)],
      ["Remaining capital", fmtMoney(v.remainingCapital)],
      ["Current month", v.durationMonths ? `${state.currentMonth} / ${v.durationMonths}` : state.currentMonth],
      ["Monthly op budget", fmtMoney(v.monthlyOperatingBudget)],
      ["Target spinouts", `${state.spinouts.length} / ${v.targetSpinouts}`],
    ];
    rows.forEach(([k, val]) => {
      const r = el("div", "stat-row");
      r.appendChild(el("span", "stat-label", k));
      r.appendChild(el("span", "stat-val", String(val)));
      stats.appendChild(r);
    });

    // investor breakdown
    const invHead = el("div", "stat-row");
    invHead.appendChild(el("span", "stat-label", "Investors"));
    invHead.appendChild(el("span", "stat-val", `${state.investors.length}`));
    stats.appendChild(invHead);
    state.investors.forEach((inv) => {
      const own = calculateInvestorVentureOwnership(inv.contributionAmount, v.fundedAmount || v.raiseTarget, v.investorPoolPercent);
      const r = el("div", "stat-row");
      r.appendChild(el("span", "stat-label", `· ${inv.name} (${fmtMoney(inv.contributionAmount)})`));
      r.appendChild(el("span", "stat-val", `${fmtPct(inv.cohortShare * 100)} cohort · ${fmtPct(own)} / spinout`));
      stats.appendChild(r);
    });

    tankRow.appendChild(stats);
    fp.appendChild(tankRow);

    const btns = el("div", "button-row");
    const bAddInv = el("button", null, "Add Investor");
    bAddInv.onclick = () => {
      const name = prompt("Investor name?", "Investor " + (state.investors.length + 1));
      if (!name) return;
      const amt = parseFloat(prompt("Contribution amount ($)?", "50000"));
      if (!amt || amt <= 0) return;
      addInvestor(state, name, Math.round(amt));
      save(); render();
    };
    const bFill = el("button", "primary", "Fill VSC1");
    bFill.disabled = v.status !== "fundraising";
    bFill.onclick = () => { fillVSC1(state); save(); render(); };

    const bAdvance = el("button", "primary", "Advance One Month ▶");
    bAdvance.disabled = v.status === "fundraising";
    bAdvance.onclick = () => { advanceOneMonth(state); save(); render(true); };

    const bReset = el("button", "danger", "Reset");
    bReset.onclick = () => { if (confirm("Reset the whole simulation?")) reset(); };

    btns.appendChild(bAddInv);
    btns.appendChild(bFill);
    btns.appendChild(bAdvance);
    btns.appendChild(bReset);
    fp.appendChild(btns);

    if (v.status === "fundraising") {
      fp.appendChild(el("p", "machine-note", "Fill VSC1 before activating the cohort — underfunding forces consulting work and breaks focus."));
    }

    grid.appendChild(fp);

    // --- Machine flow panel ---
    const mp = el("div", "panel machine");
    const flow = el("div", "flow");

    const nVSC = el("div", "flow-node");
    nVSC.appendChild(el("h3", null, "VSC1 Capital"));
    nVSC.appendChild(el("div", "big", fmtMoney(v.remainingCapital)));
    nVSC.appendChild(el("div", "small", "remaining"));
    flow.appendChild(nVSC);

    const a1 = el("div", "flow-arrow" + (pulse ? " pulse" : ""), "→");
    flow.appendChild(a1);

    const nMoP = el("div", "flow-node");
    nMoP.appendChild(el("h3", null, "MoP Operations"));
    nMoP.appendChild(el("div", "big", fmtMoney(state.mop.monthlyRevenueFromCohort)));
    nMoP.appendChild(el("div", "small", "this month · " + fmtMoney(state.mop.totalReceived) + " total"));
    flow.appendChild(nMoP);

    const a2 = el("div", "flow-arrow" + (pulse ? " pulse" : ""), "→");
    flow.appendChild(a2);

    const activeVentures = state.ventures.filter((x) => x.status === "active" || x.status === "idea").length;
    const nV = el("div", "flow-node");
    nV.appendChild(el("h3", null, "Ventures"));
    nV.appendChild(el("div", "big", String(activeVentures)));
    nV.appendChild(el("div", "small", "in pipeline · " + state.spinouts.length + " spun out"));
    flow.appendChild(nV);

    mp.appendChild(flow);
    mp.appendChild(el("div", "machine-note",
      "Each month VSC1 pays MoP <b>" + fmtMoney(v.monthlyOperatingBudget) +
      "</b> first. MoP applies focus, AI tools, marketing and contributors to the pipeline — one new idea may enter, ventures advance stages, BSSS slices fill, and revenue grows."));

    grid.appendChild(mp);
    sec.appendChild(grid);
    return sec;
  }

  // ---- Section 3: Venture pipeline ----
  function pipelineSection() {
    const sec = el("div", "section");
    sec.appendChild(el("h2", null, "Venture Pipeline"));
    sec.appendChild(el("p", "sub", "A funnel, not three static bets. Most ideas are expected to fail; capital concentrates around traction."));

    const live = state.ventures.filter((v) => v.status !== "spun_out");
    if (!live.length) {
      sec.appendChild(el("div", "empty", "No ventures in the pipeline. Advance a month to seed ideas."));
      return sec;
    }
    const grid = el("div", "pipeline-grid");
    live.forEach((v) => grid.appendChild(ventureCard(v)));
    sec.appendChild(grid);
    return sec;
  }

  function ventureCard(v) {
    const idx = stageIndex(v.stage);
    const card = el("div", "venture " + (v.status === "killed" ? "killed" : v.spinoutEligible ? "eligible" : ""));

    const head = el("div", "venture-head");
    const ht = el("div");
    ht.appendChild(el("h3", null, v.name));
    ht.appendChild(el("div", "stage-tag", `${STAGES[idx].id} · ${STAGES[idx].name}`));
    head.appendChild(ht);
    if (v.status === "killed") head.appendChild(el("span", "status-pill", "killed"));
    card.appendChild(head);

    // stage progress bar
    const bar = el("div", "stage-bar");
    STAGES.forEach((s, i) => {
      const slice = v.slices[i];
      let cls = "stage-seg";
      if (slice.status === "completed") cls += " done";
      else if (slice.status === "active") cls += " active";
      const seg = el("div", cls);
      seg.title = `${s.id} ${s.name} (${s.slicePercent}%)`;
      bar.appendChild(seg);
    });
    card.appendChild(bar);

    if (v.status === "killed") {
      card.appendChild(el("div", "kill-reason", v.killReason || "Killed."));
      return card;
    }

    const body = el("div", "venture-body");

    // pie
    const pieWrap = el("div", "pie-wrap");
    pieWrap.appendChild(bsssPie(v));
    pieWrap.appendChild(el("div", "pie-caption", "BSSS ownership (simulated)"));
    body.appendChild(pieWrap);

    // metrics
    const metrics = el("div", "metrics");
    const m = (k, val) => {
      const r = el("div", "m");
      r.appendChild(el("span", "k", k));
      r.appendChild(el("span", "v", val));
      metrics.appendChild(r);
    };
    m("MRR", fmtMoney(v.mrr));
    m("Customers", v.customers.toLocaleString("en-US"));
    m("Price", fmtMoney(v.pricePerCustomer) + "/mo");
    m("Ops load", v.opsHoursPerWeek + " hrs/wk");
    m("Cash flow", v.cashFlowPositive ? "positive" : "negative");
    m("Filled", fmtPct(earnedOwnership(v)));

    const legend = el("div", "own-legend");
    legend.style.marginTop = "8px";
    const li = (color, label, pct) => {
      const x = el("div", "li");
      const sw = el("span", "swatch");
      sw.style.background = color;
      x.appendChild(sw);
      x.appendChild(document.createTextNode(`${label} ${fmtPct(pct)}`));
      return x;
    };
    legend.appendChild(li(COLORS.investor, "Investors", groupOwnership(v, "investor")));
    legend.appendChild(li(COLORS.mop, "MoP", groupOwnership(v, "mop")));
    legend.appendChild(li(COLORS.contributor, "Contributors", groupOwnership(v, "contributor")));
    legend.appendChild(li(COLORS.unallocated, "Unallocated", Math.max(0, 100 - earnedOwnership(v))));
    metrics.appendChild(legend);

    body.appendChild(metrics);
    card.appendChild(body);

    // footer / spinout
    const foot = el("div", "venture-foot");
    if (v.spinoutEligible) {
      foot.appendChild(el("div", "elig-text yes", "Spinout eligible ✓"));
      const b = el("button", "primary tiny", "Spinout Venture");
      b.onclick = () => {
        try { spinoutVenture(v, state); save(); render(); }
        catch (e) { alert(e.message); }
      };
      foot.appendChild(b);
    } else {
      foot.appendChild(el("div", "elig-text", spinoutNeeds(v)));
    }
    card.appendChild(foot);

    return card;
  }

  function spinoutNeeds(v) {
    const need = [];
    if (v.mrr < 5000) need.push("MRR ≥ $5k");
    if (!v.cashFlowPositive) need.push("positive cash flow");
    if (v.opsHoursPerWeek > 10) need.push("ops ≤ 10 hrs");
    if (!v.hasRepeatableAcquisition) need.push("repeatable acquisition");
    if (!v.productStable) need.push("stable product");
    return need.length ? "Needs: " + need.join(", ") : "Eligible";
  }

  // SVG BSSS pie: each stage = wedge sized by slicePercent. Active/completed
  // wedges are split into investor/MoP/contributor sub-arcs; planned = gray.
  function bsssPie(v) {
    const size = 120, r = 56, cx = size / 2, cy = size / 2;
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("width", size);
    svg.setAttribute("height", size);
    svg.setAttribute("viewBox", `0 0 ${size} ${size}`);

    let angle = -Math.PI / 2; // start at top
    const TAU = Math.PI * 2;

    function arc(a0, a1, color, outline) {
      if (a1 - a0 < 0.0001) return;
      const x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0);
      const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
      const large = a1 - a0 > Math.PI ? 1 : 0;
      const p = document.createElementNS(svgNS, "path");
      p.setAttribute("d", `M ${cx} ${cy} L ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1} Z`);
      p.setAttribute("fill", color);
      if (outline) { p.setAttribute("stroke", COLORS.active); p.setAttribute("stroke-width", "2.5"); }
      else { p.setAttribute("stroke", "#14161c"); p.setAttribute("stroke-width", "0.5"); }
      svg.appendChild(p);
    }

    v.slices.forEach((slice) => {
      const wedge = (slice.slicePercent / 100) * TAU;
      const a0 = angle, a1 = angle + wedge;
      if (slice.status === "planned") {
        arc(a0, a1, COLORS.unallocated, false);
      } else {
        const totalPts = Object.values(slice.points).reduce((a, b) => a + b, 0);
        if (totalPts === 0) {
          arc(a0, a1, COLORS.unallocated, slice.status === "active");
        } else {
          // sub-split by group: investor, mop, contributor
          const groups = ["investor", "mop", "contributor"];
          let ga = a0;
          groups.forEach((g) => {
            let gp = 0;
            for (const pid in slice.points) if (participantGroup(pid) === g) gp += slice.points[pid];
            const ga1 = ga + (gp / totalPts) * wedge;
            arc(ga, ga1, COLORS[g], false);
            ga = ga1;
          });
          if (slice.status === "active") {
            // gold outline ring over the active wedge
            const outline = document.createElementNS(svgNS, "path");
            const x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0);
            const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
            const large = a1 - a0 > Math.PI ? 1 : 0;
            outline.setAttribute("d", `M ${cx} ${cy} L ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1} Z`);
            outline.setAttribute("fill", "none");
            outline.setAttribute("stroke", COLORS.active);
            outline.setAttribute("stroke-width", "2.5");
            svg.appendChild(outline);
          }
        }
      }
      angle = a1;
    });

    // center hole for donut look
    const hole = document.createElementNS(svgNS, "circle");
    hole.setAttribute("cx", cx); hole.setAttribute("cy", cy); hole.setAttribute("r", 22);
    hole.setAttribute("fill", "#1b1e27");
    svg.appendChild(hole);
    const label = document.createElementNS(svgNS, "text");
    label.setAttribute("x", cx); label.setAttribute("y", cy + 4);
    label.setAttribute("text-anchor", "middle");
    label.setAttribute("font-size", "12");
    label.setAttribute("fill", "#f0f2f7");
    label.textContent = Math.round(earnedOwnership(v)) + "%";
    svg.appendChild(label);

    return svg;
  }

  // ---- Section 4: Spinout LLCs ----
  function spinoutSection() {
    const sec = el("div", "section");
    sec.appendChild(el("h2", null, "Spinout LLCs"));
    sec.appendChild(el("p", "sub", "At spinout, BSSS ownership converts into formal ownership. The LLC pays MoP a stewardship fee; profit flows to owners."));

    if (!state.spinouts.length) {
      sec.appendChild(el("div", "empty", "No spinouts yet. Grow a venture to $5k MRR with positive cash flow, repeatable acquisition, a stable product and ≤10 ops hours/week."));
      return sec;
    }
    const grid = el("div", "spinout-grid");
    state.spinouts.forEach((llc) => grid.appendChild(llcCard(llc)));
    sec.appendChild(grid);
    return sec;
  }

  function llcCard(llc) {
    const card = el("div", "llc");
    card.appendChild(el("h3", null, llc.name));
    card.appendChild(el("div", "src", `from ${llc.sourceName} · spun out month ${llc.monthCreated}`));

    const t = el("table");
    const row = (k, val) => {
      const tr = document.createElement("tr");
      const td1 = document.createElement("td"); td1.textContent = k;
      const td2 = document.createElement("td"); td2.className = "v"; td2.textContent = val;
      tr.appendChild(td1); tr.appendChild(td2); t.appendChild(tr);
    };
    row("MRR", fmtMoney(llc.mrr));
    row("Est. valuation", fmtMoney(assetValuation(llc.mrr)));
    row("Operating expenses", fmtMoney(llc.operatingExpenses));
    row(`MoP stewardship (${llc.mopStewardshipFeePercent}%)`, fmtMoney(llc.stewardshipFee));
    row("Est. monthly profit", fmtMoney(llc.profit));
    card.appendChild(t);

    const ot = document.createElement("table");
    ot.className = "own-table";
    const th = document.createElement("tr");
    const tha = document.createElement("th"); tha.textContent = "Owner";
    const thb = document.createElement("th"); thb.textContent = "Owns"; thb.style.textAlign = "right";
    const thc = document.createElement("th"); thc.textContent = "Profit/mo"; thc.style.textAlign = "right";
    th.appendChild(tha); th.appendChild(thb); th.appendChild(thc); ot.appendChild(th);
    llc.ownership.forEach((o) => {
      const tr = document.createElement("tr");
      const td1 = document.createElement("td");
      const sw = el("span", "swatch"); sw.style.background = COLORS[o.group] || COLORS.unallocated;
      sw.style.marginRight = "6px";
      td1.appendChild(sw); td1.appendChild(document.createTextNode(o.name));
      const td2 = document.createElement("td"); td2.className = "v"; td2.textContent = fmtPct(o.percent);
      const td3 = document.createElement("td"); td3.className = "v";
      td3.textContent = o.id && llc.profit > 0 ? fmtMoney(llc.profit * (o.percent / 100)) : "—";
      tr.appendChild(td1); tr.appendChild(td2); tr.appendChild(td3); ot.appendChild(tr);
    });
    card.appendChild(ot);
    return card;
  }

  // ---- Section 5: Simulated cap table ----
  function assetValuation(mrr) { return Math.round(mrr * 12 * VALUATION_ARR_MULTIPLE); }

  // Everyone who can hold value or earn cash in the model.
  function holderList() {
    const list = [];
    state.investors.forEach((i) => list.push({ id: i.id, name: i.name, type: "Investor", group: "investor" }));
    state.contributors.forEach((c) =>
      list.push({ id: c.id, name: c.name, type: c.role === "steward" ? "Steward" : "Contributor", group: c.role === "steward" ? "mop" : "contributor" }));
    list.push({ id: "mop_entity", name: "Ministry of Product", type: "Entity", group: "mop" });
    return list;
  }

  // Live ventures (with revenue) plus spun-out LLCs — the things that have value.
  function assetList() {
    const assets = [];
    state.ventures.forEach((v) => {
      if (v.status === "killed" || v.status === "spun_out") return;
      assets.push({ name: v.name, mrr: v.mrr, spun: false, venture: v });
    });
    state.spinouts.forEach((llc) => assets.push({ name: llc.name, mrr: llc.mrr, spun: true, llc: llc }));
    return assets;
  }

  function holderAssetPercent(holder, asset) {
    if (holder.id === "mop_entity") return 0; // entity earns fees, holds no BSSS equity
    if (asset.spun) {
      const row = asset.llc.ownership.find((o) => o.id === holder.id);
      return row ? row.percent : 0;
    }
    const v = asset.venture;
    if (holder.type === "Investor") {
      const inv = state.investors.find((i) => i.id === holder.id);
      return (inv ? inv.cohortShare : 0) * groupOwnership(v, "investor");
    }
    return participantOwnership(v, holder.id);
  }

  function capTableSection() {
    const sec = el("div", "section");
    sec.appendChild(el("h2", null, "Simulated Cap Table"));
    sec.appendChild(el("p", "sub",
      "Who owns what, what each stake is worth on paper, and how much cash each has actually made. " +
      "Valuation is illustrative (≈ 5× ARR); cash earned is the cumulative profit distributions and stewardship fees paid out as months advance."));

    const assets = assetList();
    const holders = holderList();

    // --- Venture valuation strip ---
    const valWrap = el("div", "panel");
    valWrap.appendChild(el("h3", "ct-h3", "Venture values"));
    if (!assets.length) {
      valWrap.appendChild(el("div", "hint", "No ventures with value yet — advance months to grow revenue."));
    } else {
      const vt = document.createElement("table");
      vt.className = "captable";
      vt.innerHTML = "<tr><th>Venture</th><th>State</th><th class='r'>MRR</th><th class='r'>Est. valuation</th></tr>";
      assets.forEach((a) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `<td>${a.name}</td><td>${a.spun ? "<span class='tag-spun'>spun out</span>" : "pipeline"}</td>` +
          `<td class='r'>${fmtMoney(a.mrr)}</td><td class='r'>${fmtMoney(assetValuation(a.mrr))}</td>`;
        vt.appendChild(tr);
      });
      valWrap.appendChild(vt);
    }
    sec.appendChild(valWrap);

    // --- Holder table ---
    const wrap = el("div", "panel");
    wrap.style.marginTop = "16px";
    wrap.appendChild(el("h3", "ct-h3", "Holders"));
    const scroll = el("div", "ct-scroll");
    const t = document.createElement("table");
    t.className = "captable";
    t.innerHTML =
      "<tr><th>Holder</th><th>Type</th><th>Holdings (ownership · paper value)</th>" +
      "<th class='r'>Equity value</th><th class='r'>Cash earned</th><th class='r'>Total</th></tr>";

    let totEquity = 0, totCash = 0;
    holders.forEach((h) => {
      const holdings = [];
      let equity = 0;
      assets.forEach((a) => {
        const pct = holderAssetPercent(h, a);
        if (pct > 0.05) {
          const val = (pct / 100) * assetValuation(a.mrr);
          equity += val;
          holdings.push({ name: a.name, pct, val, spun: a.spun });
        }
      });
      const cash = (state.earnings && state.earnings[h.id]) || 0;
      totEquity += equity; totCash += cash;

      const tr = document.createElement("tr");
      const sw = `<span class="swatch" style="background:${COLORS[h.group] || COLORS.unallocated};margin-right:6px"></span>`;
      const tdName = `<td>${sw}${h.name}</td>`;
      const tdType = `<td><span class="status-pill">${h.type}</span></td>`;

      let hold;
      if (h.id === "mop_entity") {
        hold = `<td><span class="ct-note">10% stewardship fee on every spun-out LLC · ${fmtMoney(state.mop.totalReceived)} operating budget received (cost-recovery)</span></td>`;
      } else if (!holdings.length) {
        hold = `<td><span class="ct-note">no value-bearing holdings yet</span></td>`;
      } else {
        hold = "<td>" + holdings.map((x) =>
          `<span class="ct-hold ${x.spun ? "spun" : ""}">${x.name} ${fmtPct(x.pct)} · ${fmtMoney(x.val)}</span>`).join(" ") + "</td>";
      }
      const total = equity + cash;
      const tdEq = `<td class='r'>${equity > 0 ? fmtMoney(equity) : "—"}</td>`;
      const tdCash = `<td class='r'>${cash > 0 ? fmtMoney(cash) : "—"}</td>`;
      const tdTot = `<td class='r strong'>${total > 0 ? fmtMoney(total) : "—"}</td>`;
      tr.innerHTML = tdName + tdType + hold + tdEq + tdCash + tdTot;
      t.appendChild(tr);
    });

    const totRow = document.createElement("tr");
    totRow.className = "ct-total";
    totRow.innerHTML =
      `<td colspan="3">Totals (held equity + realized cash)</td>` +
      `<td class='r'>${fmtMoney(totEquity)}</td><td class='r'>${fmtMoney(totCash)}</td>` +
      `<td class='r strong'>${fmtMoney(totEquity + totCash)}</td>`;
    t.appendChild(totRow);

    scroll.appendChild(t);
    wrap.appendChild(scroll);
    wrap.appendChild(el("p", "hint",
      "Equity value is unrealized paper value of BSSS stakes. Cash earned accrues only after a venture spins out and starts paying monthly profit. Stewards are also compensated from MoP's operating budget (not shown as equity)."));
    sec.appendChild(wrap);
    return sec;
  }

  // ---- Activity log ----
  function logSection() {
    const sec = el("div", "section");
    if (!state.log.length) return sec;
    sec.appendChild(el("h2", null, "Studio Activity"));
    const panel = el("div", "panel");
    panel.style.maxHeight = "160px";
    panel.style.overflowY = "auto";
    state.log.slice(0, 12).forEach((entry) => {
      const r = el("div", "stat-row");
      r.appendChild(el("span", "stat-label", `Month ${entry.month}`));
      r.appendChild(el("span", "stat-val", entry.msg));
      r.querySelector(".stat-val").style.textAlign = "right";
      r.querySelector(".stat-val").style.maxWidth = "78%";
      panel.appendChild(r);
    });
    sec.appendChild(panel);
    return sec;
  }

  // ---- Explanation copy ----
  function explainSection() {
    const sec = el("div", "section");
    sec.appendChild(el("h2", null, "How To Read This"));
    const grid = el("div", "explain");
    const cards = [
      ["VSC1", "The first venture studio cohort. Investors fund the cohort, not Ministry of Product itself. The cohort funds one year of focused venture creation."],
      ["MoP", "Ministry of Product is the steward and operating system. It receives monthly operating funds from the cohort and uses them to validate, build, launch, and grow ventures."],
      ["Ventures", "Ventures move from Idea to Stable. Each stage has a fixed BSSS ownership slice. Contributors and investors earn portions of those slices through points and capital."],
      ["BSSS", "Big Slice / Small Slice. Each stage opens a Big Slice with a fixed %. Your Small Slice = your points ÷ total points in that slice. Completed slices lock and can't be diluted."],
      ["Spinouts", "At $5k MRR with positive cash flow, repeatable acquisition, a stable product and ≤10 mgmt hrs/week, a venture spins out into an LLC and BSSS becomes formal ownership."],
      ["Target Shape", "The studio looks for ventures that could plausibly reach ~10,000 customers paying ~$15/month. Not a guarantee — a target shape used to decide which ideas deserve attention."],
    ];
    cards.forEach(([h, p]) => {
      const c = el("div", "card");
      c.appendChild(el("h3", null, h));
      c.appendChild(el("p", null, p));
      grid.appendChild(c);
    });
    sec.appendChild(grid);
    return sec;
  }

  // kick off
  render();
})();
