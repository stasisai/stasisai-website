---
title: Mathematical Simulation Core
description: How MAFIS leverages Bevy for systems execution tracking.
---

Instead of running a large endless while-loop common in pure academic solvers, MAFIS breaks pathfinding into discrete state machines within Bevy's Application model.

## Game States

The `SimState` tracks the macro behavior:
```rust
pub enum SimState {
    Setup,
    Running,
    Paused,
    Finished,
    Idle,
}
```

## Internal System Sets

Inside the `Running` state, MAFIS mandates strict execution phases. Without this, physics and algorithms would cross-contaminate. The `FixedUpdate` loop explicitly orders execution:

1. **`CoreSet::PreTick`**: Analyzes the map, handles user inputs.
2. **`CoreSet::Tick`**: Executes a single step of the pathfinding solver (e.g., PIBT generating next actions).
3. **`FaultSet::Heat`** -> **`FaultSet::FaultCheck`**: Applies environmental decay. If an agent dies, it triggers a system blockage.
4. **`FaultSet::Replan`**: Immediately catches stranded nodes and forces localized paths to recalculate instantly.
5. **`CoreSet::PostTick`**: Finalizes movement into raw rendering positions.
6. **`AnalysisSet::Metrics`**: Writes the latency values and telemetry for external exports.

This ensures chaos injection occurs synchronously and predictably despite thousands of parallelized entities.
