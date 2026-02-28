---
title: PIBT (Priority Inheritance)
description: Technical overview of the Priority Inheritance with Backtracking algorithm in Stasis AI.
---

**Priority Inheritance with Backtracking (PIBT)** is a suboptimal, decentralized, and highly reactive algorithm originally designed for real-time logistics scenarios.

## How It Works

Instead of calculating entire paths from start to finish beforehand, PIBT calculates only the next step for each agent at every timestep.

1. **Prioritization**: Agents are assigned a unique priority.
2. **Move Proposing**: The highest priority agent proposes its next move towards its target.
3. **Inheritance**: If the agent wishes to move into a cell occupied by a lower-priority agent, the lower-priority agent temporarily *inherits* the higher priority and is forced to move out of the way.
4. **Backtracking**: If a chain of inherited moves reaches a dead end, the algorithm backtracks, and agents are forced to wait.

## Advantages for Fault Injection

PIBT is the default algorithm for our **Interactive Grid** because it shines in dynamic environments. When a simulated hardware crash occurs (Inject Fault), PIBT's reactive nature allows surrounding agents to instantly reroute around the newly frozen "dead" agent without needing a complete system-wide recalculation.
