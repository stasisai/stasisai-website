---
title: Core ECS Design
description: The Bevy ECS patterns at the core of MAFIS — SimState machine, system sets, FixedUpdate pipeline, and how the two-phase simulation is implemented.
---

MAFIS runs inside Bevy's ECS `App`. Instead of a monolithic simulation loop, logic is split into discrete systems organized into system sets with guaranteed execution order. The `SimState` state machine gates which systems run and when.

## SimState Machine

```rust
#[derive(States, Debug, Clone, PartialEq, Eq, Hash, Default)]
pub enum SimState {
    #[default]
    Setup,
    Running,
    Paused,
    Replay,
    Finished,
    Idle,
}
```

| State | Description |
|---|---|
| `Setup` | Initial state, resources being initialized |
| `Running` | Full simulation pipeline active, snapshots recording during fault phase |
| `Paused` | Simulation frozen, camera interactive, manual fault injection available |
| `Replay` | Reading from `TickHistory` snapshot buffer, simulation systems inactive |
| `Finished` | `task_limit` reached, simulation complete |
| `Idle` | Between runs, configuration panel visible |

> [!IMPORTANT] `Paused` and `Replay` are distinct states with different behaviors: `Paused` allows step-forward (runs one real tick) and manual fault injection. `Replay` is read-only — only the snapshot cursor moves, no new ticks are simulated.

## SimulationPhase

The current simulation phase is tracked separately from `SimState`:

```rust
pub enum SimulationPhase {
    Warmup,
    FaultInjection,
}
```

`SimState::Running` can be in either phase. Phase transitions are automatic: after `warmup_ticks` (default 200), `SimulationPhase` transitions from `Warmup` to `FaultInjection` and faults activate.

## System Sets

All simulation logic runs under `FixedUpdate` (deterministic tick rate, independent of frame rate):

```rust
#[derive(SystemSet, Debug, Clone, PartialEq, Eq, Hash)]
pub enum CoreSet {
    Tick,
    PostTick,
}

#[derive(SystemSet, Debug, Clone, PartialEq, Eq, Hash)]
pub enum FaultSet {
    Heat,
    FaultCheck,
    Replan,
}

#[derive(SystemSet, Debug, Clone, PartialEq, Eq, Hash)]
pub enum AnalysisSet {
    Metrics,
}
```

Execution order is configured in `App::build()`:

```
CoreSet::Tick
  → FaultSet::Heat
  → FaultSet::FaultCheck
  → FaultSet::Replan
  → CoreSet::PostTick
  → AnalysisSet::Metrics
```

All system sets run only in `SimState::Running`. Individual systems may additionally gate on `SimulationPhase`.

## Full System Pipeline

```
FixedUpdate (SimState::Running):
  CoreSet::Tick
    tick_agents           consume next action from each agent's planned_path
    recycle_goals         detect goal completion, assign new goals via TaskScheduler
    lifelong_replan       batch replan for agents with needs_replan=true

  FaultSet::Heat
    accumulate_heat       update per-agent heat, check overheat_threshold

  FaultSet::FaultCheck
    propagate_cascade     ADG → BFS cascade computation
    register_fault_events create FaultEventRecord for new fault events

  FaultSet::Replan
    replan_after_fault    replan agents affected by new obstacles

  CoreSet::PostTick
    sync_render_positions update render transforms from logical positions

  AnalysisSet::Metrics
    update_fault_metrics  MTTR, throughput, idle ratio, survival rate
    update_scorecard      resilience scorecard (planned)
    record_tick_snapshot  store TickSnapshot if FaultInjection phase (planned)
    check_phase_transition Warmup → FaultInjection after warmup_ticks
```

## Resource Initialization

All resources are initialized in `controls.rs` (Bevy `Startup` system) before `SimState::Setup` completes:

- `GridMap` — default 32×32 open grid
- `SeededRng` — default seed 42
- `FaultConfig` — medium fault intensity defaults
- `ActiveSolver` — PIBT
- `ActiveScheduler` — RandomScheduler
- `ResilienceBaseline` — zero-initialized, filled during warmup
- `FaultMetrics` — zero-initialized
- `TickHistory` — empty, recording=false

## Determinism Guarantee

> [!IMPORTANT] Every system that modifies world state reads from `SeededRng`. No system uses `rand::thread_rng()` or any other external randomness source. This ensures that two runs with identical configuration and seed produce identical state at every tick — a requirement for tick history rewind accuracy.

## Adding a New System

To add a system to the pipeline:

1. Write the system function in the appropriate module.
2. Add it to the correct `SystemSet` in `App::build()`.
3. Add ordering constraints if needed (`.after(other_system)` or `.before()`).
4. Gate on `SimState::Running` and/or `SimulationPhase` as appropriate.

Systems that should not run during Replay mode should gate on `state == SimState::Running` (not `SimState::Replay`). The replay rendering system is the only system that reads from `TickHistory` during Replay.
