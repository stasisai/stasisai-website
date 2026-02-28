---
title: Breakdown Faults
description: Injecting sudden and absolute hardware deaths.
---

In a real operational environment, an agent may physically break down and lose its ability to move. In **MAFIS**, this is represented as a **Breakdown Fault**.

## Mechanics

When an agent suffers a Breakdown (whether through manual injection or probabilistic chance), its component state is permanently updated. 

```rust
pub enum FaultType {
    Overheat,
    Breakdown,
}
```

A breakdown removes the agent from the active solver queue. The agent physically remains on the `Grid`, creating a permanent static obstacle exactly where it failed.

## Re-planning

Because map paths and constraints are tightly coupled in CBS and PIBT algorithms, a newly formed static object represents a critical violation of previously valid paths.

The Bevy ECS engine detects this breakdown in the `FaultSet::FaultCheck` phase and triggers an immediate re-evaluation:

```rust
breakdown::replan_after_fault
    .in_set(FaultSet::Replan)
    .run_if(in_state(SimState::Running))
```

This systems isolates all agents whose planned paths intersect the stranded agent, forcing them to re-run pathfinding locally, measuring the algorithm's capability to dynamically heal the network.
