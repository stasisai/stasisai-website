---
title: Grid Structures
description: The GridMap resource — coordinate system, obstacle encoding, walkability queries, and how faults modify the grid at runtime.
---

MAFIS uses a discrete 2D grid for all path planning and collision detection. The grid is stored as a Bevy `Resource` accessed by solvers, fault systems, and the task scheduler.

## GridMap

```rust
#[derive(Resource, Debug)]
pub struct GridMap {
    pub width: i32,
    pub height: i32,
    obstacles: HashSet<IVec2>,
}
```

`obstacles` is a `HashSet<IVec2>` providing O(1) membership tests. All pathfinding and collision queries go through `GridMap`'s API — solvers never access `obstacles` directly.

## Core API

```rust
impl GridMap {
    pub fn new(width: i32, height: i32) -> Self;

    pub fn is_in_bounds(&self, pos: IVec2) -> bool;
    pub fn is_obstacle(&self, pos: IVec2) -> bool;
    pub fn is_walkable(&self, pos: IVec2) -> bool {
        self.is_in_bounds(pos) && !self.is_obstacle(pos)
    }

    pub fn set_obstacle(&self, pos: IVec2);
    pub fn remove_obstacle(&self, pos: IVec2);

    pub fn walkable_neighbors(&self, pos: IVec2) -> Vec<IVec2>;
}
```

`walkable_neighbors` returns the subset of the 4 cardinal neighbors (North, South, East, West) that are in-bounds and not obstacles. The current position (Wait) is not included — callers append it manually when needed.

## Coordinate System

All positions use integer `IVec2` (`x: i32, y: i32`):
- Origin `(0, 0)` is the bottom-left cell.
- X increases East, Y increases North.
- Bounds: `0 ≤ x < width`, `0 ≤ y < height`.

There is no floating-point position in the logical simulation. Rendering uses `Transform` with fractional coordinates for smooth visual interpolation, but these are derived from the logical `IVec2` position at render time.

## Fault Modifications at Runtime

When a fault kills an agent, the fault system calls `grid.set_obstacle(agent_pos)` immediately in `FaultSet::FaultCheck`. This modifies the shared `GridMap` resource that all systems read. From the next `FaultSet::Replan` onward, the new obstacle is visible to PIBT and all pathfinding queries.

For `TemporaryBlockage` faults, the blockage system calls `set_obstacle` at fault time and schedules a future `remove_obstacle` after N ticks.

> [!IMPORTANT] This pattern — mutating the shared `GridMap` resource as the single source of geometric truth — ensures that all systems (solver, cascade, heat, scheduler) see the same world state without any synchronization overhead.

## Initialization

`GridMap` is initialized in `controls.rs` during `Startup`. The default grid is generated using the seeded RNG and the configured obstacle density:

```rust
let mut grid = GridMap::new(width, height);
for pos in all_cells {
    if rng.gen::<f32>() < obstacle_density {
        grid.set_obstacle(pos);
    }
}
```

Start and goal positions for agents are validated against the grid before spawning — `assert!(grid.is_walkable(start))`.

## Distance Maps

The `DistanceMap` precomputation (BFS flood-fill from goal) runs on the `GridMap` snapshot at planning time. If new obstacles are added by faults between planning cycles, distance maps from previous ticks may be stale. PIBT handles this naturally — it replans from current positions using fresh distance maps computed on the current `GridMap` — but solvers that cache distance maps must invalidate them on `GridMap` mutation.

See [Spacetime A*](/docs/researchers/solvers/astar) for the distance map API, and [Cascade Propagation](/docs/researchers/fault-mechanics/breakdown-faults) for how fault-created obstacles trigger replanning.
