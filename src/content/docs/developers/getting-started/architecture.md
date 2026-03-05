---
title: MAFIS Architecture
description: Module map and design philosophy for the MAFIS Rust/Bevy/WASM codebase — core, solver, fault, task, analysis, ui, and render.
---

MAFIS is a Bevy 0.18 application compiled to WebAssembly. It runs as a WASM module embedded in the `/simulator` page, with a thin HTML/CSS/JS control layer that communicates with the Rust engine via `wasm-bindgen`.

## Module Map

```
src/
  core/           Simulation state machine, grid, agents, actions
  solver/         MAPFSolver trait, PIBT, Spacetime A*, heuristics
  fault/          Fault types, heat system, cascade propagation
  task/           TaskScheduler trait, LifelongConfig, replanning
  analysis/       Metrics, scorecard, tick history, export
  ui/             Bridge (wasm-bindgen), controls initialization
  render/         3D mesh animator, visual agent representation
```

## core — Simulation Foundation

`src/core/` owns the fundamental simulation state: the grid geometry, agent data, action types, and the `SimState` machine.

- `grid.rs` — `GridMap` resource: O(1) walkability, obstacle management, `walkable_neighbors`
- `agent.rs` — `LogicalAgent`, `AgentIndex`, `AgentRegistry`
- `action.rs` — `Action` enum (`Wait`, `Move(Direction)`), `Direction::ALL`, `action.apply()`
- `simulation.rs` — `SimState` machine, `FixedUpdate` schedule, system set registration
- `state.rs` — `SimState` enum: `Setup`, `Running`, `Paused`, `Replay`, `Finished`
- `seed.rs` — `SeededRng` resource (ChaCha8, deterministic)
- `task.rs` — `TaskScheduler` trait, `LifelongConfig`, `recycle_goals`, `lifelong_replan`

## solver — Path Planning

`src/solver/` contains the `MAPFSolver` trait and all solver implementations. Only lifelong-capable solvers live here — one-shot solvers are on the `archive/one-shot-solvers` branch.

- `traits.rs` — `MAPFSolver`, `SolverInfo`, `SolverError`
- `mod.rs` — `SOLVER_NAMES` registry, `solver_from_name` factory
- `pibt.rs` — `PibtSolver`, `pibt_one_step`, `pibt_one_step_constrained`, `pibt_assign`
- `astar.rs` — `spacetime_astar`, `Constraints`, vertex/edge constraints (infrastructure)
- `heuristics.rs` — `DistanceMap`, `manhattan`, `chebyshev`, `delta_to_action`

## fault — Chaos Engine

`src/fault/` models all four fault types and their cascade consequences.

- `config.rs` — `FaultConfig` resource (heat params, breakdown probability, overheat threshold)
- `heat.rs` — `accumulate_heat` system, `HeatmapState` resource, dissipation
- `breakdown.rs` — `propagate_cascade` system (ADG → BFS), `register_fault_recovery`
- `manual.rs` — `ManualFaultCommand`, `process_manual_faults` system (planned)

## task — Lifelong MAPF

`src/core/task.rs` drives the lifelong simulation loop. It is in `core/` because it is fundamental to the simulation, not a swappable component.

- `TaskScheduler` trait — `name()`, `assign_task(grid, agent_pos, rng) -> IVec2`
- `RandomScheduler` — uniform random walkable cell (current default)
- `ActiveScheduler` resource — wraps the currently selected scheduler
- `LifelongConfig` component — `tasks_completed`, `task_limit`, `needs_replan`, `throughput_window`
- `recycle_goals` system — detects goal completion, assigns new goals, sets `needs_replan`
- `lifelong_replan` system — batch replanning for all `needs_replan` agents

## analysis — Observability

`src/analysis/` computes and stores all research outputs.

- `fault_metrics.rs` — `FaultMetrics` resource: MTTR, recovery rate, cascade depth/spread, throughput, idle ratio, survival rate
- `scorecard.rs` — `ResilienceScorecard` resource: 4 resilience metrics (planned)
- `history.rs` — `TickSnapshot`, `TickHistory`, `record_tick_snapshot` system (planned)
- `export.rs` — JSON/CSV export of all metrics and scorecard values

## ui — JS↔Rust Bridge

`src/ui/` is the boundary layer between Rust and the web frontend.

- `bridge.rs` — `get_simulation_state() -> String` (JSON), `send_command(cmd: &str)` — both `#[wasm_bindgen]`
- `controls.rs` — Bevy `Startup` system that initializes all resources with default values

> [!NOTE] The bridge is polled from JS at 100ms intervals. `get_simulation_state()` serializes the current simulation state to JSON. `send_command()` dispatches commands like `start`, `pause`, `set_scheduler random`, `seek_to_tick 312`. The bridge is the **only** communication channel — there is no shared memory between JS and Rust.

## render — 3D Visualization

`src/render/` converts logical simulation state to 3D visuals in the Bevy viewport.

- `animator.rs` — interpolates agent mesh positions between ticks, handles dead agent visuals, reconstructs agent positions from `TickSnapshot` during Replay
- Visual encoding: agent color = heat level, dead agents = distinct color + no movement

## System Pipeline

```
FixedUpdate (SimState::Running):
  CoreSet::Tick
    tick_agents           move agents by one action from planned_path
    recycle_goals         detect goal completion, assign new goals
    lifelong_replan       batch replan for needs_replan agents

  FaultSet::Heat          accumulate_heat, check overheat_threshold
  FaultSet::FaultCheck    propagate_cascade (ADG → BFS), record FaultEventRecord
  FaultSet::Replan        replan agents affected by new faults

  CoreSet::PostTick       finalize positions for rendering

  AnalysisSet::Metrics
    update_fault_metrics  MTTR, throughput, idle ratio, survival rate
    update_scorecard      robustness, recoverability, adaptability, slope (planned)
    record_tick_snapshot  store TickSnapshot if FaultInjection phase (planned)
```

## JS↔Rust Bridge

The WASM module exposes two functions via `#[wasm_bindgen]`:

```rust
#[wasm_bindgen]
pub fn get_simulation_state() -> String { /* JSON */ }

#[wasm_bindgen]
pub fn send_command(cmd: &str) { /* dispatch */ }
```

JS polls `get_simulation_state()` every 100ms and updates the UI. `send_command()` sends imperative commands. The bridge is the only communication channel — there is no shared memory between JS and Rust.

See [Quick Start](/docs/developers/getting-started/quick-start) for the WASM build pipeline.
