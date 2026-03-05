---
title: Introduction to MAFIS
description: What MAFIS is, why lifelong fault resilience matters, and what MAFIS is NOT — a clear orientation for researchers.
---

**MAFIS** is a **fault resilience observatory** for lifelong multi-agent path finding (MAPF). It measures how multi-agent systems degrade, recover, and adapt under real-world conditions — faults, congestion, and cascading failures — sustained over continuous operation.

## What MAFIS Measures

The core question MAFIS answers is not "which algorithm is fastest?" — it is: **does performance in ideal conditions predict resilience under faults?**

A system that is "worse" in perfect conditions may be "better" under sustained fault injection. MAFIS produces the evidence to prove or disprove this for different combinations of (scheduler, topology, fault intensity). The primary research variables are:

| Variable | Current options |
|---|---|
| **Scheduler strategy** | Random (baseline) |
| **Fault intensity** | Off / Low / Medium / High |
| **Grid topology** | Random grid, MovingAI imports |

The solver (PIBT) is held constant. PIBT is the only lifelong-native solver in the project — it plans one step at a time and naturally handles dynamic goal reassignment and mid-simulation fault events. One-shot solvers (CBS, LaCAM, PBS, LNS2) are archived on the `archive/one-shot-solvers` branch.

## Lifelong Mode

MAFIS operates in **lifelong MAPF mode** by default: agents continuously receive new tasks after completing current ones. The simulation never ends because agents run out of work — it ends when the researcher stops it or a task limit is reached.

Lifelong operation is fundamental to fault resilience research. Faults only matter when the system must keep running. A solver that cannot operate in lifelong mode cannot be evaluated here — there is no production scenario where a fleet of robots completes one task and stops.

## Two-Phase Simulation

Every run has two automatic phases:

1. **Warmup** — faults suppressed, baseline metrics captured (throughput, idle ratio, task duration)
2. **Fault Injection** — faults active, all metrics computed as deltas from the baseline

This structure makes resilience metrics quantitative. A throughput of 1.8 goals/tick only means something relative to a baseline of 2.4 goals/tick. See [Simulation Phases](/docs/researchers/observatory/simulation-phases).

## Resilience Scorecard

At the end of a fault injection run, MAFIS produces a four-metric **Resilience Scorecard**:

- **Robustness** — how much does throughput drop per fault?
- **Recoverability** — how fast does throughput return?
- **Adaptability** — does the system redistribute traffic after a fault?
- **Degradation Slope** — does the system degrade gracefully or collapse?

See [Resilience Scorecard](/docs/researchers/observatory/resilience-scorecard).

## What MAFIS Is NOT

> [!WARNING] **Not a solver benchmark.** MAFIS does not compare algorithms against each other. Algorithm baseline comparisons are [MAPF Tracker](https://tracker.pathfinding.ai/)'s domain.

> [!WARNING] **Not a static testbed.** There are no rigid instance sets. For standardized 2D grid environments and scenarios, see [MovingAI MAPF Benchmarks](https://movingai.com/benchmarks/mapf.html).

> [!WARNING] **Not a one-shot simulator.** MAFIS does not measure time-to-completion for a fixed set of start/goal pairs. It measures degradation under continuous operation.

## Getting Oriented

- For the research framing: [Simulation Phases](/docs/researchers/observatory/simulation-phases) and [Resilience Scorecard](/docs/researchers/observatory/resilience-scorecard)
- For fault mechanics: [Fault Types](/docs/researchers/fault-mechanics/chaos-engineering) and [Cascade Propagation](/docs/researchers/fault-mechanics/breakdown-faults)
- For the solver: [PIBT](/docs/researchers/solvers/pibt)
- For developers: [Architecture](/docs/developers/getting-started/architecture)
