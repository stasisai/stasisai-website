---
title: Scenarios & Configuration
description: How to configure a MAFIS simulation run — LifelongConfig, SeededRng, task limits, scheduler selection, warmup duration, and grid topology.
---

A MAFIS simulation run is defined by a combination of configuration parameters set before starting. These parameters determine the grid topology, agent count, fault intensity, scheduler strategy, and warmup duration. All randomness is controlled by `SeededRng`, ensuring that any run can be reproduced exactly by reusing the same seed.

## SeededRng

All randomness in MAFIS flows through a single `SeededRng` resource:

```rust
#[derive(Resource)]
pub struct SeededRng {
    pub seed: u64,
    pub rng: ChaCha8Rng,
}
```

`SeededRng` is used for:
- Grid obstacle generation (random maps)
- Initial agent placement
- `RandomScheduler` task assignment
- `breakdown_probability` rolls

> [!TIP] With the same seed and configuration, two runs produce identical fault events at identical ticks with identical cascade consequences. This is required for the tick history rewind to be a reliable research tool — the snapshot you rewind to is exactly what happened, not a re-simulation.

## LifelongConfig

Each agent carries a `LifelongConfig` component that controls its task assignment behavior:

```rust
pub struct LifelongConfig {
    pub enabled: bool,
    pub tasks_completed: u64,
    pub task_limit: Option<u64>,
    pub needs_replan: bool,
    pub throughput_window: VecDeque<f64>,
}
```

`task_limit` is an optional stop condition. When the total tasks completed across all agents reaches the limit, the simulation transitions to `SimState::Finished`. Setting `task_limit = num_agents` approximates one-shot behavior — each agent completes one task and the simulation ends. This is not the primary use case but is available for controlled experiments.

## Configuration Parameters

The following parameters are set in the configuration panel before starting a run:

| Parameter | UI Control | Effect |
|---|---|---|
| Agent count | Slider | Number of agents spawned |
| Grid size | Dropdown | Grid dimensions (width × height) |
| Obstacle density | Slider | Fraction of cells blocked at generation |
| Seed | Input | RNG seed for reproducibility |
| Scheduler | Dropdown | Task assignment strategy (currently: Random) |
| Task limit | Input (optional) | Stop condition on total tasks completed |
| Fault intensity | Dropdown | Off / Low / Medium / High (sets FaultConfig presets) |
| Warmup duration | Slider | Ticks in Warmup phase before fault injection begins (default: 200) |

## Grid Topology

MAFIS currently generates grids algorithmically using the seed-controlled noise functions. Grid parameters:

- **Random:** Uniform random obstacle placement at the specified density. Simple, reproducible, good for baseline comparisons.
- **MovingAI import:** Standard `.map` format grids from the MovingAI benchmarks suite (see [MovingAI MAPF Benchmarks](https://movingai.com/benchmarks/mapf.html)) — planned, not yet implemented.

## Reproducible Research

To reproduce a published result:
1. Record the seed, agent count, grid size, obstacle density, scheduler, fault intensity, and warmup duration.
2. Set all parameters identically in the configuration panel.
3. The simulation will produce identical fault events at identical ticks.

The tick history snapshot buffer records the fault phase only, not the warmup phase. Warmup is deterministic from the seed — the snapshot buffer starts at the moment fault injection begins.

## Bridge Commands

Simulation configuration is also accessible via the JS↔Rust bridge:

```
set_scheduler random
set_task_limit 500
set_lifelong true
```

> [!WARNING] These commands are effective before the simulation starts. Changes to scheduler or task limit after a run has begun are not supported — configure before starting.
