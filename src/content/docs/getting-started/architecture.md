---
title: MAFIS Architecture
description: Overview of the MAFIS (Multi-Agent Fault Injection Simulator) technical stack.
---

MAFIS entirely relies on a modern, deeply optimized systems programming stack tailored to large-scale simulations.

## 1. Rust & Bevy Engine (The Core)

The core logic, pathfinding algorithms, and spatial interactions are written in **Rust**.
Rather than an object-oriented approach, we use **Bevy Engine’s Entity Component System (ECS)**. This provides phenomenal cache locality and parallel execution paths. By breaking our agents into fine-grained components, computing agent paths per tick remains entirely bound to minimal latency constraints.

Here is a glimpse of our fundamental agent component structure in the engine:

```rust
use bevy::prelude::*;
use std::collections::VecDeque;

#[derive(Component, Debug)]
pub struct LogicalAgent {
    pub current_pos: IVec2,
    pub goal_pos: IVec2,
    pub planned_path: VecDeque<Action>,
}
```

## 2. Solver Architectures

Instead of keeping solving tightly coupled to our rendering layer, MAFIS logically separates pathfinding via robust abstractions.
Solvers—such as conflict-based search (CBS) or PIBT—run cleanly. This separation allows us to safely and continuously query solver paths while handling real-time runtime events like faults and hardware simulation failures.

## 3. Fault Injection and State Mutations

In a traditional MAPF solver, everything is static. In MAFIS, the engine acts as an adversary.
Using Bevy's robust event systems, custom fault injection logic can broadcast sudden failures to agents mid-simulation. This invalidates planned paths dynamically, forcing real-time recalculations and highlighting cascading system latencies.
