---
title: Resilience Scorecard
description: The four metrics that characterize a system's fault resilience profile — Robustness, Recoverability, Adaptability, and Degradation Slope.
---

The **Resilience Scorecard** is a set of four metrics computed during the fault injection phase. Together they give a complete characterization of how a (solver, scheduler, topology, fault intensity) configuration responds to sustained faults. The scorecard is displayed in the right sidebar and exported with every run.

```
RESILIENCE SCORECARD
  Robustness       0.87
  Recoverability   12 ticks
  Adaptability     0.64
  Degradation      -0.003/tick  (Stable)
```

---

## 1. Robustness

*How much does throughput drop per fault?*

$$R = 1 - \frac{\overline{\Delta T}}{T_b}$$

| Variable | Meaning |
|---|---|
| $R$ | Robustness score ∈ [0, 1] |
| $\overline{\Delta T}$ | Mean throughput dip per fault, averaged over $W = 20$ ticks post-fault |
| $T_b$ | Baseline throughput (goals/tick) captured during warmup |

- **Range:** 0.0 (throughput collapses on every fault) → 1.0 (faults have no throughput effect).
- **Data sources:** `FaultMetrics.throughput` + `ResilienceBaseline.baseline_throughput`

> [!TIP] **Example:** $T_b = 2.4$ goals/tick. Mean dip per fault = $0.31$ goals/tick. $R = 1 - (0.31 / 2.4) = 0.87$.

---

## 2. Recoverability

*How fast does throughput return after a disruption?*

$$t_{\text{rec}} = \frac{1}{|F|} \sum_{f \in F} \bigl( t_f^{\uparrow} - t_f^{\downarrow} \bigr)$$

| Variable | Meaning |
|---|---|
| $F$ | Set of all fault events in the run |
| $t_f^{\downarrow}$ | First tick where throughput drops below $0.8 \cdot T_b$ after fault $f$ |
| $t_f^{\uparrow}$ | First tick where throughput recovers above $0.9 \cdot T_b$ after fault $f$ |
| $t_{\text{rec}}$ | Mean recovery duration in ticks (lower = better) |

- **Unit:** ticks (lower = better).
- **Data sources:** `FaultMetrics.throughput` time-series + `ResilienceBaseline`

> [!NOTE] **Edge cases:** If throughput never drops below 80%, the fault is recorded as "absorbed" ($t_f^\downarrow - t_f^\uparrow = 0$). If throughput never returns above 90%, the event is marked "not recovered" and excluded from the mean.

> [!TIP] **Example:** Three faults recovered in 8, 12, and 16 ticks. $t_{\text{rec}} = (8 + 12 + 16) / 3 = 12$ ticks.

---

## 3. Adaptability

*Does the system redistribute traffic after a fault?*

$$A = \frac{H(t_f + w) - H(t_f)}{H_{\max}}$$

| Variable | Meaning |
|---|---|
| $H(t)$ | Shannon entropy of heatmap cell density at tick $t$ |
| $t_f$ | Tick at which fault $f$ occurred |
| $w$ | Recovery window (ticks) over which redistribution is observed |
| $H_{\max}$ | Maximum possible entropy for this grid size ($\log_2$ of walkable cell count) |
| $A$ | Adaptability score ∈ [0, 1] |

- **Entropy increases** → agents redistributed to new routes → system adapted.
- **Entropy stays flat** → agents jammed at the blockage → no adaptation.
- **Data source:** `HeatmapState.density` — requires heatmap active during fault phase.

> [!NOTE] Adaptability is distinct from recoverability. A system can recover throughput quickly without redistributing routes (agents detour around the specific blockage), or it can redistribute broadly while still showing throughput loss. Both dimensions are independent research signals.

---

## 4. Degradation Slope

*Does the system degrade gracefully or collapse?*

$$\beta = \frac{\sum_{t} \bigl(t - \bar{t}\bigr)\bigl(T(t) - \bar{T}\bigr)}{\sum_{t} \bigl(t - \bar{t}\bigr)^2}$$

| Variable | Meaning |
|---|---|
| $T(t)$ | Throughput (goals/tick) at tick $t$ during fault injection |
| $\bar{t},\, \bar{T}$ | Means of $t$ and $T(t)$ over the fault phase window |
| $\beta$ | Ordinary least-squares slope of throughput over time (goals/tick²) |

- Recomputed every 50 ticks (not every tick).
- **Labels:**

| Slope $\beta$ | Label |
|---|---|
| $> -0.001$ | **Stable** |
| $-0.005$ to $-0.001$ | **Degrading** |
| $< -0.005$ | **Collapsing** |
| $> +0.001$ | **Improving** |

> [!IMPORTANT] Near-zero $\beta$ means the system reached a new equilibrium under faults and maintains it. A strongly negative $\beta$ means each additional fault degrades capacity further — a sign of structural fragility that will eventually produce collapse.

---

## Export

All four scorecard values are included in the JSON/CSV export alongside the raw fault metrics. This allows offline analysis and cross-run comparison.

## Implementation

The scorecard is computed by the `update_resilience_scorecard` system in `AnalysisSet::Metrics`, running after `update_fault_metrics`. It reads from `FaultMetrics`, `ResilienceBaseline`, and `HeatmapState` — no new data collection systems are needed.

See [Simulation Phases](/docs/researchers/observatory/simulation-phases) for how the baseline is established, and [Fault Metrics](/docs/researchers/metrics/fault-metrics) for the raw metrics the scorecard builds on.
