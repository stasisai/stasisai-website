---
title: Task Scheduling
description: How MAFIS assigns tasks to agents in lifelong mode — the TaskScheduler trait, the RandomScheduler, and why scheduler strategy is the primary research variable.
---

In lifelong MAPF, agents continuously receive new tasks after completing their current ones. The component that decides which goal to assign to which agent is the **TaskScheduler**. Scheduler strategy — not solver algorithm — is the primary research variable in MAFIS.

## Why Scheduler Strategy Matters

PIBT is held constant as the solver. What varies across research configurations is:

1. **Scheduler strategy** — how tasks are assigned
2. **Fault intensity** — how frequently and severely faults occur
3. **Grid topology** — the map structure (corridor width, bottlenecks, density)

> [!IMPORTANT] The same solver on the same map under the same fault intensity can produce radically different resilience profiles depending on how tasks are assigned. A scheduler that concentrates agents in narrow corridors produces high cascade depth and low adaptability. A scheduler that distributes load broadly produces lower baseline throughput but better fault resilience.

## The TaskScheduler Trait

```rust
pub trait TaskScheduler: Send + Sync + 'static {
    fn name(&self) -> &str;
    fn assign_task(&self, grid: &GridMap, agent_pos: IVec2, rng: &mut SeededRng) -> IVec2;
}
```

Every scheduler receives the current grid, the agent's position, and the seeded RNG. It returns a goal position. The return value must be a walkable cell different from the agent's current position.

## Active Scheduler

The currently selected scheduler is wrapped in `ActiveScheduler`:

```rust
pub struct ActiveScheduler {
    scheduler: Box<dyn TaskScheduler>,
    name: String,
}
```

The scheduler can be changed before starting the simulation via the scheduler dropdown in the configuration panel, or via bridge command:

```
set_scheduler random
```

## RandomScheduler (Current)

The only scheduler currently implemented. Picks any walkable cell that is not the agent's current position, uniformly at random.

```rust
pub struct RandomScheduler;
// Picks any walkable cell ≠ current position
```

`RandomScheduler` serves as the baseline for all comparisons. Its uniform distribution means agents are spread across the entire grid by task assignment alone, which tends to produce moderate cascade depth and good adaptability.

## LifelongConfig

Each agent carries a `LifelongConfig` component:

```rust
pub struct LifelongConfig {
    pub enabled: bool,
    pub tasks_completed: u64,
    pub task_limit: Option<u64>,
    pub needs_replan: bool,
    pub throughput_window: VecDeque<f64>,
}
```

`tasks_completed` increments every time an agent reaches its goal and receives a new task. `task_limit` is an optional stop condition — when `tasks_completed >= task_limit` across all agents, the simulation ends. Setting `task_limit = num_agents` approximates one-shot behavior (each agent completes one task).

## Replanning Strategy

MAFIS uses **batch-and-replan**: after each tick, agents that reached their goals are collected, new goals are assigned via the active scheduler, then all agents are replanned from current positions in a single pass. This produces zero overhead on ticks with no completions.

## Future Schedulers

The `TaskScheduler` trait is designed for extension. Planned schedulers include:

| Scheduler | Strategy |
|---|---|
| **Nearest-first** | Assign the closest walkable goal to minimize travel distance |
| **Balanced** | Track agent distribution and bias new goals toward under-occupied regions |
| **Warehouse-aware** | Prioritize high-value zones (packing stations, exits) with configurable weights |

Each of these will produce a distinct resilience profile under the same fault conditions — that comparison is the research output MAFIS is built to generate.

See [Simulation Phases](/docs/researchers/observatory/simulation-phases) for how the warmup baseline is established before comparing scheduler profiles.
