---
title: Adding Solvers
description: How to implement a new lifelong-capable MAPF solver in MAFIS using the MAPFSolver trait, register it in the module, and verify it with tests.
---

> [!IMPORTANT] Only **lifelong-capable** solvers belong in MAFIS. One-shot solvers (CBS, LaCAM, PBS, LNS2) are archived on the `archive/one-shot-solvers` branch — they cannot run in lifelong mode and produce non-actionable results for fault resilience research.

## The `MAPFSolver` Trait

All solvers implement `MAPFSolver` defined in `src/solver/traits.rs`:

```rust
pub trait MAPFSolver: Send + Sync + 'static {
    fn name(&self) -> &str;
    fn info(&self) -> SolverInfo;
    fn solve(
        &self,
        grid: &GridMap,
        agents: &[(IVec2, IVec2)],
    ) -> Result<Vec<Vec<Action>>, SolverError>;
}
```

`solve()` is called on every replan trigger (agents reaching goals, fault-induced replanning). It must return a collision-free action sequence for every agent.

### SolverInfo

```rust
pub struct SolverInfo {
    pub optimality: Optimality,
    pub complexity: &'static str,
    pub scalability: Scalability,
    pub description: &'static str,
    pub recommended_max_agents: Option<usize>,
}
```

Set `recommended_max_agents` to `None` for lifelong solvers that scale well (like PIBT). The UI uses this field to show warnings.

### SolverError

```rust
pub enum SolverError {
    NoSolution,
    Timeout,
    InvalidInput(String),
}
```

On `Err`, the system falls back to PIBT automatically (see `lifelong_replan` in `src/core/task.rs`).

## Step-by-Step: Adding a New Solver

### 1. Create `src/solver/my_solver.rs`

```rust
use bevy::prelude::*;
use crate::core::action::Action;
use crate::core::grid::GridMap;
use super::traits::{MAPFSolver, Optimality, Scalability, SolverError, SolverInfo};

pub struct MySolver {
    pub max_iterations: usize,
}

impl Default for MySolver {
    fn default() -> Self { Self { max_iterations: 1_000 } }
}

impl MAPFSolver for MySolver {
    fn name(&self) -> &str { "my_solver" }

    fn info(&self) -> SolverInfo {
        SolverInfo {
            optimality: Optimality::Suboptimal,
            complexity: "O(?)",
            scalability: Scalability::Medium,
            description: "My custom solver.",
            recommended_max_agents: None,
        }
    }

    fn solve(
        &self,
        grid: &GridMap,
        agents: &[(IVec2, IVec2)],
    ) -> Result<Vec<Vec<Action>>, SolverError> {
        if agents.is_empty() { return Ok(Vec::new()); }

        for (i, (start, goal)) in agents.iter().enumerate() {
            if !grid.is_walkable(*start) {
                return Err(SolverError::InvalidInput(format!("agent {i} start not walkable")));
            }
            if !grid.is_walkable(*goal) {
                return Err(SolverError::InvalidInput(format!("agent {i} goal not walkable")));
            }
        }

        todo!("implement solver logic")
    }
}
```

### 2. Register in `src/solver/mod.rs`

Three additions:

```rust
// 1. Module declaration
pub mod my_solver;

// 2. SOLVER_NAMES registry (drives UI dropdown)
pub const SOLVER_NAMES: &[(&str, &str)] = &[
    ("pibt", "PIBT — Priority Inheritance"),
    ("my_solver", "My Solver — Brief Label"),  // add
];

// 3. Factory function
pub fn solver_from_name(name: &str) -> Option<Box<dyn MAPFSolver>> {
    match name {
        "pibt" => Some(Box::new(PibtSolver::default())),
        "my_solver" => Some(Box::new(MySolver::default())),  // add
        _ => None,
    }
}
```

The UI dropdown, `set_solver` bridge command, and auto-switch logic all read from `SOLVER_NAMES` and `solver_from_name`.

### 3. Add tests

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::grid::GridMap;

    fn solver() -> MySolver { MySolver::default() }
    fn open5() -> GridMap { GridMap::new(5, 5) }

    fn final_pos(plan: &[Action], start: IVec2) -> IVec2 {
        let mut pos = start;
        for &a in plan { pos = a.apply(pos); }
        pos
    }

    #[test]
    fn empty_agents_returns_empty_plan() {
        assert!(solver().solve(&open5(), &[]).unwrap().is_empty());
    }

    #[test]
    fn single_agent_reaches_goal() {
        let agents = vec![(IVec2::ZERO, IVec2::new(4, 4))];
        let result = solver().solve(&open5(), &agents).unwrap();
        assert_eq!(final_pos(&result[0], IVec2::ZERO), IVec2::new(4, 4));
    }

    #[test]
    fn invalid_start_returns_error() {
        let mut grid = open5();
        grid.set_obstacle(IVec2::new(2, 2));
        let agents = vec![(IVec2::new(2, 2), IVec2::new(4, 4))];
        assert!(solver().solve(&grid, &agents).is_err());
    }
}
```

### 4. Verify

```bash
cargo check    # ~5s
cargo test     # ~7s
```

WASM build is not needed for pure solver changes.

## Lifelong Requirement

> [!WARNING] Your solver will be called repeatedly during lifelong simulation whenever agents get new goals. The frame budget is approximately **10ms for 500 agents**. PIBT achieves ~1–2ms at this scale. If your solver is slower, it should use `recommended_max_agents` to warn users.

Your solver must also handle **dynamic obstacle additions** correctly — faults add permanent obstacles mid-simulation. Since `solve()` always receives the current `GridMap`, and the grid already reflects all fault-created obstacles, no special handling is needed. The solver always plans on the current state.

## Shared Infrastructure

### Spacetime A* (`src/solver/astar.rs`)

```rust
pub fn spacetime_astar(
    grid: &GridMap,
    start: IVec2,
    goal: IVec2,
    agent: usize,
    constraints: &Constraints,
    max_time: u64,
) -> Result<Vec<Action>, SolverError>
```

A* over `(position, time)` state space with vertex and edge constraints. Available as infrastructure for solvers that need constrained single-agent planning (e.g., RHCR uses PIBT as a subroutine with constrained positions).

### Heuristics (`src/solver/heuristics.rs`)

- `manhattan(a, b) -> u64` — L1 distance
- `DistanceMap::compute(grid, goal)` — BFS flood-fill, O(W×H), O(1) lookup
- `compute_distance_maps(grid, agents)` — one distance map per agent goal

### Grid (`src/core/grid.rs`)

- `GridMap::new(width, height)` — open grid
- `grid.is_walkable(pos) -> bool` — bounds + obstacle check
- `grid.set_obstacle(pos)` — mark cell blocked

### Actions (`src/core/action.rs`)

```rust
pub enum Action { Wait, Move(Direction) }
pub enum Direction { North, South, East, West }
```

- `action.apply(pos) -> IVec2` — apply action to position
- `Direction::ALL` — all 4 cardinal directions
