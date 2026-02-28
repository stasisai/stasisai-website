---
title: Agent Components
description: How agents are structured logically within Bevy ECS.
---

Instead of Object-Oriented generic structures, MAFIS deeply relies on Bevy Engine's **ECS (Entity Component System)** to ensure variables are strictly isolated, leading to massive cache locality gains.

Agents are defined natively in `src/core/agent.rs`.

## The `LogicalAgent` Component

The primary component tracking spatial existence and paths:

```rust
#[derive(Component, Debug)]
pub struct LogicalAgent {
    pub current_pos: IVec2,
    pub goal_pos: IVec2,
    pub planned_path: VecDeque<Action>,
}
```

By keeping paths as a `VecDeque<Action>`, memory allocation is perfectly streamlined for agents consuming actions every simulation tick. Let's explore standard functions attached:

```rust
impl LogicalAgent {
    pub fn has_reached_goal(&self) -> bool {
        self.current_pos == self.goal_pos
    }

    pub fn has_plan(&self) -> bool {
        !self.planned_path.is_empty()
    }
}
```

## Abstracting Entities with `AgentIndex`

In standard Bevy logic, entities are raw hashes. To make solvers independent from rendering or graphical identification, MAFIS utilizes an `AgentRegistry`. It safely maps raw Bevy entities to strict mathematical limits:

```rust
#[derive(Component, Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct AgentIndex(pub usize);
```

This strict architectural separation is why the Engine can drop a `Breakdown` directly into an entity slot, and the solver immediately interprets that index grid ID as invalid.
