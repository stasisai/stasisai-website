---
title: Spacetime A*
description: Spacetime A* is solver infrastructure in MAFIS — a constrained single-agent planner over (position, time) state space used by future multi-agent solvers as a low-level subroutine.
---

**Spacetime A*** is not a standalone MAPF solver in MAFIS — it is **infrastructure** for solvers that need constrained single-agent path planning. It plans a path for one agent through a `(position, time)` state space while respecting vertex and edge constraints imposed by other agents' plans.

## Role in the Architecture

> [!NOTE] PIBT, the current solver, does not use Spacetime A*. PIBT plans greedily one step at a time and resolves conflicts via priority inheritance. Spacetime A* is available as an extension point for future solvers.
 The planned **RHCR** (Rolling-Horizon Collision Resolution) solver will use PIBT one-step as a subroutine with pre-decided constrained positions — and RHCR or CBS-like solvers that plan over time windows would use Spacetime A* for their inner single-agent planning loop.

## API

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

| Parameter | Description |
|---|---|
| `grid` | Current grid map (reflects all fault-created obstacles) |
| `start` | Agent's current position |
| `goal` | Target position |
| `agent` | Agent index (used for constraint matching) |
| `constraints` | Vertex and edge constraints from other agents' plans |
| `max_time` | Time horizon (returns `Err(Timeout)` if exceeded) |

Returns a sequence of `Action::Wait` and `Action::Move(Direction)` steps.

## State Space

The planner searches over states `(position: IVec2, time: u64)`. At each state, it expands to:
- `Action::Wait` → `(position, time + 1)`
- `Action::Move(d)` for each cardinal direction → `(position + d.offset(), time + 1)` if walkable

The heuristic is BFS distance from the current position to the goal (precomputed via `DistanceMap`).

## Constraints

```rust
pub struct VertexConstraint {
    pub agent: usize,
    pub pos: IVec2,
    pub time: u64,
}

pub struct EdgeConstraint {
    pub agent: usize,
    pub from: IVec2,
    pub to: IVec2,
    pub time: u64,
}
```

- **Vertex constraint:** agent cannot be at `pos` at `time`.
- **Edge constraint:** agent cannot move from `from` to `to` at `time` (prevents agents swapping positions in one step).

`Constraints` is a struct holding both lists, indexed for fast lookup.

## Heuristics Infrastructure

Spacetime A* uses `DistanceMap` from `src/solver/heuristics.rs`:

```rust
pub struct DistanceMap {
    // BFS flood-fill from goal, stored as flat Vec<u64> for cache-friendly O(1) lookup
}

impl DistanceMap {
    pub fn compute(grid: &GridMap, goal: IVec2) -> DistanceMap;
    pub fn get(&self, pos: IVec2) -> u64;
}
```

One `DistanceMap` per agent goal. Precomputing all distance maps before solving — `compute_distance_maps(grid, agents)` — is the standard pattern.

Additional heuristics:
- `manhattan(a, b) -> u64` — L1 distance (fast, inadmissible with obstacles)
- `chebyshev(a, b) -> u64` — L-infinity distance
- `delta_to_action(from, to) -> Action` — convert position delta to action enum

## Connection to PIBT Constrained Mode

Future solvers that use PIBT as a subroutine interact via `pibt_one_step_constrained`:

```rust
pub fn pibt_one_step_constrained(
    positions: &[IVec2],
    goals: &[IVec2],
    grid: &GridMap,
    dist_maps: &[DistanceMap],
    priorities: &mut [f64],
    constraints: &[(usize, IVec2)],  // pre-decided agent→vertex assignments
) -> Vec<Action>
```

Pre-decided agents are fixed before PIBT runs. Unconstrained agents treat these positions as obstacles. Spacetime A* can compute the pre-decided positions that PIBT then takes as input.

## Code Location

- `src/solver/astar.rs` — `spacetime_astar`, `Constraints`, `VertexConstraint`, `EdgeConstraint`
- `src/solver/heuristics.rs` — `DistanceMap`, `manhattan`, `chebyshev`, `delta_to_action`, `compute_distance_maps`
