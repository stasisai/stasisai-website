---
title: Task Scheduler
description: Implementation details for the TaskScheduler trait, LifelongConfig, the batch-and-replan pipeline, and the task module in src/core/task.rs.
---

The task scheduling system lives in `src/core/task.rs` and drives lifelong MAPF operation. It manages goal assignment, completion tracking, and replanning triggers.

## File: `src/core/task.rs`

### TaskScheduler Trait

```rust
pub trait TaskScheduler: Send + Sync + 'static {
    fn name(&self) -> &str;
    fn assign_task(&self, grid: &GridMap, agent_pos: IVec2, rng: &mut SeededRng) -> IVec2;
}
```

> [!IMPORTANT] Requirements for implementors:
> - Return value must be a walkable cell (`grid.is_walkable(pos) == true`).
> - Return value must not equal `agent_pos`.
> - Must be deterministic given the same `rng` state (no hidden global state).
> - Must complete within the frame budget (~10ms for 500 agents).

### RandomScheduler

```rust
pub struct RandomScheduler;

impl TaskScheduler for RandomScheduler {
    fn name(&self) -> &str { "random" }

    fn assign_task(&self, grid: &GridMap, agent_pos: IVec2, rng: &mut SeededRng) -> IVec2 {
        // Randomly sample walkable cells until one ≠ agent_pos is found
    }
}
```

### ActiveScheduler Resource

```rust
pub struct ActiveScheduler {
    pub scheduler: Box<dyn TaskScheduler>,
    pub name: String,
}
```

Stored as a Bevy `Resource`. Changed via `set_scheduler` bridge command before simulation start.

### LifelongConfig Component

```rust
pub struct LifelongConfig {
    pub enabled: bool,
    pub tasks_completed: u64,
    pub task_limit: Option<u64>,
    pub needs_replan: bool,
    pub throughput_window: VecDeque<f64>,
}
```

One per agent entity. `needs_replan` is set to `true` by `recycle_goals` when the agent reaches its goal and a new goal has been assigned. `lifelong_replan` checks this flag to know which agents need new plans.

## System Pipeline

```
FixedUpdate (SimState::Running):
  CoreSet::Tick
    tick_agents           ← skip Finished state if lifelong enabled
    recycle_goals   (NEW) ← detect goal-reached, assign new goals via scheduler
    lifelong_replan (NEW) ← if needs_replan, replan all affected agents

  FaultSet::Heat → FaultSet::FaultCheck → FaultSet::Replan
  CoreSet::PostTick → AnalysisSet::*
```

### recycle_goals System

Runs after `tick_agents`. For each agent that reached its goal this tick:
1. Increment `tasks_completed`
2. Call `scheduler.assign_task(grid, agent_pos, rng)` to get new goal
3. Set `agent.goal = new_goal`
4. Set `lifelong_config.needs_replan = true`
5. Check against `task_limit` — if limit reached, transition to `SimState::Finished`

### lifelong_replan System

Runs after `recycle_goals`. Collects all agents with `needs_replan == true` and runs a batch replan from current positions. After replanning, clears `needs_replan`. Uses PIBT (via `ActiveSolver`) with fallback to PIBT on solver error.

## Bridge Integration

New JSON fields in `get_simulation_state()` output:

```json
{
  "lifelong": {
    "enabled": true,
    "tasks_completed": 1847,
    "throughput": 2.4,
    "scheduler": "random"
  }
}
```

New bridge commands:

| Command | Effect |
|---|---|
| `set_lifelong true` | Enable lifelong mode (default: enabled) |
| `set_task_limit 500` | Stop when 500 total tasks completed |
| `set_scheduler random` | Set active scheduler (before start) |

## Determinism

`SeededRng` is passed to every `assign_task` call. The RNG is seeded from the global simulation seed, ensuring that two runs with identical configuration and seed produce identical task assignment sequences. This is required for tick history rewind to be accurate.

## Adding a New Scheduler

See [Adding Solvers](/docs/developers/contributing/adding-solvers) for the pattern — schedulers follow the same registration approach. The key steps:

1. Implement `TaskScheduler` in `src/core/task.rs`
2. Add to the `SCHEDULER_NAMES` registry
3. Add to the `scheduler_from_name` factory function
4. The UI dropdown and `set_scheduler` bridge command read from these automatically
