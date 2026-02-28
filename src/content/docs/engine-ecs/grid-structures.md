---
title: Grid Interpretation
description: Map boundaries and spatial querying in MAFIS.
---

Because MAPF algorithms require instantaneous geometry, MAFIS separates mathematical limits from graphical meshes.

## The GridMap Resource

The `GridMap` handles the core topology. It is injected into Bevy globally as a Resource, meaning any system (Solver, Physics, Rendering) can query it in O(1) time.

```rust
#[derive(Resource, Debug)]
pub struct GridMap {
    pub width: i32,
    pub height: i32,
    obstacles: HashSet<IVec2>,
}
```

## Abstracting Physics

Because standard physics engines are float-based (continuous logic with rounding errors), MAFIS bypasses classical physics entirely for path calculations. The grid operates purely on discretized logic using the `IVec2` (`x: i32, y: i32`) structure.

To calculate if a space is viable, an agent or a solver simply calls:

```rust
pub fn is_walkable(&self, pos: IVec2) -> bool {
    self.is_in_bounds(pos) && !self.is_obstacle(pos)
}
```

And finding immediate neighboring cells (North, South, East, West, Wait) is automatically restricted to safe coordinates:

```rust
pub fn walkable_neighbors(&self, pos: IVec2) -> Vec<IVec2> {
    // ... Returns mathematically valid adjacent tiles
}
```

When a `Breakdown` fault occurs on an agent, the chaos engine essentially calls `set_obstacle(agent_pos)` directly on this `GridMap`, instantaneously sealing the geometry against all solvers simultaneously.
