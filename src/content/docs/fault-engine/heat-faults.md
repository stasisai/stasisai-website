---
title: Heat Mechanics
description: Modeling congestion, thermal runaway, and queueing penalties.
---

A unique characteristic of MAFIS is its abstract representation of environmental penalty through "Heat."

## What is Heat?

In heavy robotic swarms, dense areas lacking airflow, constant braking, and clustering can quickly drain battery life or cause thermal stress.

MAFIS tracks this penalty via the `heat::accumulate_heat` system at every tick.

## Factors of Accumulation

Heat builds up dynamically based on several spatial factors defined in `FaultConfig`:

1. **Movement (`heat_per_move`)**: Navigating grid cells generates minor heat.
2. **Waiting (`heat_per_wait`)**: Stopping to yield to another agent generates heat (often higher penalty for prolonged congestion).
3. **Congestion Radius (`congestion_heat_radius`)**: Merely being near other operating agents adds a `congestion_heat_bonus`. High-density traffic bottlenecks rapidly overheat entire corridors.
4. **Dissipation (`heat_dissipation`)**: When moving sparsely, heat bleeds off.

## Thermal Runaway

When an agent's heat passes the `overheat_threshold` (e.g., `80.0`), a `FaultType::Overheat` is triggered. While an Overheat may not completely kill the agent like a Hardware Breakdown, it drastically increases the `breakdown_probability`, potentially causing a localized collapse in the warehouse.

This mechanic forces map designers and algorithm researchers to evaluate strategies that don't just find the shortest path, but actively spread out agents to minimize thermal density.
