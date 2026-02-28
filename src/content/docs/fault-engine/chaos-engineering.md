---
title: Chaos Engineering in MAPF
description: Using the environment as an active adversary.
---

Testing Multi-Agent Path Finding (MAPF) algorithms usually assumes a static, perfect environment. However, real-world deployments—such as automated warehouses with AGVs (Automated Guided Vehicles)—feature hardware fatigue, sensor lag, and battery issues.

**MAFIS** takes an adversarial approach. Instead of merely checking if an algorithm finds a path, it tests if the algorithm can *survive* the environment.

## Bevy ECS Event Systems

To implement dynamic, spontaneous faults without tightly coupling the pathfinding logic to the rendering layer, MAFIS relies heavily on Bevy's Event system.

When the user clicks on the simulation grid to "stun" a cell or an agent, an event is fired. For example, a `FaultEvent` is broadcast across the ECS:

```rust
pub struct FaultEvent {
    pub entity: Entity,
    pub fault_type: FaultType,
}
```

The fault systems listen for these events every tick. If an agent receives a `FaultType::Breakdown`, they become a rigid obstacle on the grid, forcing all surrounding agents to rapidly queue or recalculate.

## Configurable Chaos

Through configuration resources (e.g., `FaultConfig`), the engine controls global variables defining how easily the system collapses under stress. Parameters such as `breakdown_probability`, `heat_per_wait`, or `overheat_threshold` actively stress test solver implementations.

By tweaking these probabilities and examining the cascading consequences through the built-in [Analysis Modules](/getting-started/architecture), MAFIS allows stress-testing of algorithms like PIBT to see precisely when they fail to clear congestion.

Proceed to read about our structural fault models: [Breakdowns](/fault-engine/breakdown-faults) and [Heat Mechanics](/fault-engine/heat-faults).
