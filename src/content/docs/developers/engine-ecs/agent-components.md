---
title: Agent Components
description: The Bevy components that make up a MAFIS agent — LogicalAgent, AgentIndex, LifelongConfig, AgentActionStats, and how they compose at runtime.
---

Each agent entity in MAFIS is composed of several ECS components. Components are pure data — they carry no logic. Systems query for specific component combinations and update state.

## LogicalAgent

The primary component for spatial and planning state:

```rust
#[derive(Component, Debug)]
pub struct LogicalAgent {
    pub current_pos: IVec2,
    pub goal_pos: IVec2,
    pub planned_path: VecDeque<Action>,
}

impl LogicalAgent {
    pub fn has_reached_goal(&self) -> bool {
        self.current_pos == self.goal_pos
    }

    pub fn has_plan(&self) -> bool {
        !self.planned_path.is_empty()
    }
}
```

`planned_path` is a `VecDeque<Action>` — the `tick_agents` system pops the front action each tick and applies it to `current_pos`. When the queue is empty and the agent hasn't reached its goal, replanning is needed.

## AgentIndex

A stable identifier used by solvers and the cascade system:

```rust
#[derive(Component, Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct AgentIndex(pub usize);
```

> [!NOTE] Bevy `Entity` IDs are not stable across despawn/respawn. `AgentIndex` provides a fixed 0-based index that solvers use to reference agents. `AgentRegistry` (a resource) maps between `AgentIndex` and `Entity`.

## LifelongConfig

Controls the agent's participation in lifelong task assignment:

```rust
#[derive(Component)]
pub struct LifelongConfig {
    pub enabled: bool,
    pub tasks_completed: u64,
    pub task_limit: Option<u64>,
    pub needs_replan: bool,
    pub throughput_window: VecDeque<f64>,
}
```

The `recycle_goals` system sets `needs_replan = true` when an agent reaches its goal and a new goal has been assigned. `lifelong_replan` clears this flag after replanning. `throughput_window` tracks recent goal completion rates for the sliding-window throughput metric.

## AgentActionStats

Per-agent action statistics, used for the Idle Ratio metric and `AgentSnapshot` serialization:

```rust
#[derive(Component, Default)]
pub struct AgentActionStats {
    pub total_actions: u32,
    pub wait_actions: u32,
    pub move_actions: u32,
}
```

The `tick_agents` system increments these counters every tick based on which action the agent executed. The global idle ratio is the mean `wait_actions / total_actions` across all living agents.

## FaultState

Tracks the agent's current fault status:

```rust
#[derive(Component, Default)]
pub struct FaultState {
    pub heat: f32,
    pub is_dead: bool,
    pub fault_type: Option<FaultType>,
    pub latency_ticks_remaining: u32,
}
```

`heat` is updated by `accumulate_heat` every tick. When `heat > overheat_threshold`, `is_dead` is set to `true`, `fault_type` is set to `FaultType::Overheat`, and the agent's cell is added to `GridMap` as an obstacle.

`latency_ticks_remaining > 0` causes the agent to execute `Action::Wait` regardless of PIBT's decision — the agent is alive and occupying a cell but unresponsive for N ticks.

## SimulationPhase and ResilienceBaseline

These are `Resource`s (not components), but are closely related to the analysis pipeline:

```rust
pub enum SimulationPhase {
    Warmup,
    FaultInjection,
}

pub struct ResilienceBaseline {
    pub baseline_throughput: f64,
    pub baseline_idle_ratio: f64,
    pub baseline_avg_task_duration: f64,
    pub warmup_ticks: u64,
    pub warmup_complete: bool,
}
```

`ResilienceBaseline` is populated at the end of the Warmup phase by averaging the last N warmup ticks of throughput, idle ratio, and task duration. All resilience scorecard computations reference these baseline values.

## Full Component Bundle per Agent

When spawning an agent, the full component bundle is:

```rust
commands.spawn((
    LogicalAgent {
        current_pos: start,
        goal_pos: goal,
        planned_path: VecDeque::new(),
    },
    AgentIndex(i),
    LifelongConfig::default(),
    AgentActionStats::default(),
    FaultState::default(),
    // ... render components (Transform, Mesh, etc.)
));
```

## Component Access Patterns

Common query patterns used by systems:

```rust
// tick_agents: advance all living agents
Query<(&mut LogicalAgent, &mut AgentActionStats, &FaultState)>

// recycle_goals: detect completions, assign new goals
Query<(&mut LogicalAgent, &mut LifelongConfig, &AgentIndex)>

// accumulate_heat: update heat for all living agents
Query<(&LogicalAgent, &mut FaultState), Without<Dead>>

// update_fault_metrics: compute idle ratio
Query<&AgentActionStats>
```

> [!TIP] Systems use `Without<Dead>` marker component to exclude dead agents from heat and action processing. Dead agents remain in the world as static obstacle representations until the simulation ends.
