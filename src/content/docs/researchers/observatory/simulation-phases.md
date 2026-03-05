---
title: Simulation Phases
description: The two-phase simulation model — Warmup followed by Fault Injection — and how MAFIS uses the warmup baseline to compute quantitative resilience deltas.
---

Every MAFIS simulation run has two automatic phases: **Warmup** then **Fault Injection**. The phases are not manual toggles — they are the default run structure. The warmup baseline is what makes resilience metrics quantitative rather than absolute.

## Phase 1: Warmup

During warmup, faults are suppressed. The simulation runs lifelong PIBT with agents continuously receiving new tasks, building up a stable operating profile. At the end of the warmup window, three baseline values are captured:

| Baseline field | Description |
|---|---|
| `baseline_throughput` | Goals completed per tick (sliding window average) |
| `baseline_idle_ratio` | Fraction of ticks agents spend waiting rather than moving |
| `baseline_avg_task_duration` | Average ticks per completed task |

The default warmup window is **200 ticks**, configurable via the warmup duration slider in the configuration panel.

> [!NOTE] During warmup, no faults fire and no fault metrics are computed. The header shows progress: `WARMUP (84/200)`.


## Phase 2: Fault Injection

Once warmup completes, faults activate automatically. All configured fault sources become active (heat accumulation, automatic breakdown probability, or manual injection). The phase continues until the simulation is stopped or a task limit is reached.

The header transitions to: `FAULTS ACTIVE (tick 312)`.

> [!IMPORTANT] All resilience metrics — robustness, recoverability, adaptability, degradation slope — are computed as **deltas from the warmup baseline**. A throughput reading of 1.8 goals/tick only means something relative to a baseline of 2.4 goals/tick.

## SimulationPhase Resource

The current phase is tracked in the `SimulationPhase` enum:

```rust
pub enum SimulationPhase {
    Warmup,
    FaultInjection,
}
```

Systems that should only run during fault injection gate on `phase == FaultInjection`. The tick history recording system, for example, only records during fault injection — warmup ticks are baseline-only and not worth rewinding to.

## ResilienceBaseline Resource

```rust
pub struct ResilienceBaseline {
    pub baseline_throughput: f64,
    pub baseline_idle_ratio: f64,
    pub baseline_avg_task_duration: f64,
    pub warmup_ticks: u64,       // configurable, default 200
    pub warmup_complete: bool,
}
```

## Research Implications

The two-phase structure is what enables **comparative research**. The question is never "what is the throughput?" in isolation — it is "how much does throughput drop, and for how long, relative to the no-fault baseline, under this (scheduler, topology, fault intensity) configuration?"

Different configurations can have identical fault-phase throughput but very different baselines, which produces completely different resilience profiles. The warmup phase makes this comparison rigorous.

See [Resilience Scorecard](/docs/researchers/observatory/resilience-scorecard) for the four metrics computed from the baseline delta.
