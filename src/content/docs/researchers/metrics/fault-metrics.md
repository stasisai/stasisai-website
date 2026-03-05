---
title: Fault Metrics
description: The research-grade KPIs computed by MAFIS during fault injection — MTTR, Recovery Rate, Cascade Depth, Cascade Spread, Throughput, Idle Ratio, and Fault Survival Rate.
---

MAFIS computes seven fault metrics during the fault injection phase (`src/analysis/fault_metrics.rs`). Each is measured against the warmup baseline so results are comparative rather than absolute. The primary research variables swept against these metrics are **scheduler strategy**, **fault intensity**, and **grid topology** — not the solver (PIBT is held constant).

---

## MTTR — Mean Time To Recovery

**Unit:** Ticks | **Scope:** Per fault event, aggregated to mean

When an agent dies and becomes an obstacle, surrounding agents must replan around it. MTTR measures how many ticks it takes on average for affected agents to have a valid new plan and resume moving toward their goal.

> [!NOTE] **Real-world analogy:** A warehouse robot breaks down in an aisle. MTTR answers: "How long does the fleet take to reroute?" A low MTTR means the system adapts quickly. A high MTTR means the algorithm struggles to find alternatives, producing a traffic jam that ripples outward.

> [!TIP] **Research use:** With PIBT as the fixed solver, MTTR is primarily driven by scheduler strategy and corridor geometry. The same solver can produce vastly different recovery profiles depending on how tasks are assigned and where agents are concentrated.

---

## Recovery Rate

**Unit:** Percentage (0–100%) | **Scope:** Global aggregate

Of all agents affected by a fault (forced to replan), what percentage successfully found a new path versus deadlocked or got permanently stuck?

> [!NOTE] **Real-world analogy:** If 10 robots are blocked by a breakdown, recovery rate tells you: "8 out of 10 found alternate routes, 2 need human intervention." 100% means the system is self-healing.

> [!TIP] **Research use:** This separates *slow recovery* from *no recovery*. High MTTR + 100% recovery = slow but reliable. Low MTTR + 80% recovery = fast but lossy. Very different operational profiles — and the difference is driven by how tasks are distributed, not the pathfinding algorithm alone.

---

## Cascade Depth

**Unit:** Levels (integer) | **Scope:** Per fault event

When agent A dies, agent B must replan because A blocks its path. B's new path now blocks C, who blocks D. Cascade depth measures how many levels deep this chain reaction goes.

> [!NOTE] **Real-world analogy:** A highway pileup. One car stops, the car behind brakes, the next one brakes, etc. Depth = 1 means only direct neighbors are affected. Depth = 5 means a single fault destabilized agents five hops away.

> [!TIP] **Research use:** High cascade depth reveals structural fragility. In lifelong mode, cascade depth depends on corridor width, agent density, and scheduling strategy. A scheduler that concentrates agents in narrow corridors produces higher cascade depth than one that distributes load.

**Implementation:** Computed by the `propagate_cascade` system via an Agent Dependency Graph (ADG). See [Cascade Propagation](/docs/researchers/fault-mechanics/breakdown-faults).

---

## Cascade Spread

**Unit:** Agent count (integer) | **Scope:** Per fault event, aggregated to mean

The total number of agents affected by a single fault event — not just the chain length.

> [!NOTE] **Real-world analogy:** Depth = 3 but spread = 50 means the chain was short but wide — each level affected many agents simultaneously. Think of a bottleneck corridor where one blockage affects everyone queued behind it.

> [!TIP] **Research use:** Spread identifies topological vulnerabilities. If one cell's fault consistently produces spread > 30% of the fleet, that cell is a critical infrastructure point. Combined with the heatmap, this pinpoints exactly where the map design is fragile.

---

## Throughput

**Unit:** Goals per tick (float, sliding window) | **Scope:** Global rate

Running rate of how many agents reach their goals per unit of simulation time. Not a cumulative total — the rate. The sliding window smooths tick-to-tick variance.

> [!NOTE] **Real-world analogy:** In logistics, "packages delivered per hour." When a fault occurs, throughput drops — the question is how much and for how long.

> [!TIP] **Research use:** Throughput under fault vs baseline throughput = the fault penalty ratio. The warmup phase captures baseline automatically. Different schedulers produce different penalty profiles — a nearest-first scheduler might have higher baseline throughput but a worse fault penalty than a random scheduler that naturally distributes load.

---

## Idle Ratio

**Unit:** Percentage (0–100%) | **Scope:** Per-agent and global aggregate

Percentage of ticks where agents execute `Action::Wait` instead of moving. Measures how much time agents spend blocked, waiting for others, or assigned a wait by the algorithm.

> [!NOTE] **Real-world analogy:** Robot utilization rate. If 500 robots have 40% idle ratio, you're paying for 500 but getting the work of 300. Under faults, idle ratio spikes because agents are stuck behind blockages.

> [!TIP] **Research use:** Idle ratio distinguishes path quality from throughput. Two configurations might have the same throughput but one achieves it with 10% idle (efficient routing) and the other with 50% idle (stop-and-go waves). It also shows the congestion signature of each scheduler strategy.

**Per-agent tracking:** Each agent carries an `AgentActionStats` component tracking `total_actions`, `wait_actions`, and `move_actions`. The global idle ratio is computed as the mean across all living agents.

---

## Fault Survival Rate

**Unit:** Percentage (0–100%), time-series | **Scope:** Global, sampled every tick

Percentage of agents still alive (not broken down) at any given tick. A time-series curve, not a single number.

> [!NOTE] **Real-world analogy:** Fleet attrition rate. "After 1000 ticks, 85% of the fleet is still operational." This directly impacts fleet sizing decisions — if you need 400 active robots and survival rate at $T = 1000$ is 80%, you need to deploy 500.

> [!IMPORTANT] **Research use:** Plotted alongside throughput, the survival curve reveals whether the system degrades linearly (lose 10% robots → lose 10% throughput) or collapses nonlinearly (lose 10% robots → lose 50% throughput due to cascades). Nonlinear collapse is the dangerous regime MAFIS is designed to expose.

---

## Relationship to the Resilience Scorecard

The Resilience Scorecard (Robustness, Recoverability, Adaptability, Degradation Slope) is computed from these raw metrics. Throughput and the baseline drive three of the four scorecard values. See [Resilience Scorecard](/docs/researchers/observatory/resilience-scorecard) for the full formulas.
