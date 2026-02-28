---
title: A* (A-Star)
description: The baseline algorithmic pathfinder.
---

A* is a classic pathfinding algorithm and the foundational building block for most MAPF solvers.

In MAFIS, `src/solver/astar.rs` implements a time-space A* pathfinder. It is responsible for finding the shortest path for a single agent from its start position to its goal, taking into account basic static constraints.

## Time-Space Pathfinding

Unlike standard 2D A* that only considers $X$ and $Y$ coordinates, MAPF requires pathfinding in 3 Dimensions: $X$, $Y$, and $Time$ (Ticks).

This ensures an agent doesn't just ask "can I move here?", but "can I move here *at tick T*?".

## Limitations

As a standalone algorithm, A* is purely single-agent. If multiple agents use A* simultaneously, they are unaware of each other's planned positions and will collide. It is typically utilized as the low-level search subroutine inside more complex multi-agent solvers like CBS or as a quick fallback.
