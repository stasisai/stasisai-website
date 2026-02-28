---
title: PIBT (Priority-Based Search)
description: A real-time, purely reactive, scalable algorithm.
---

**PIBT (Priority-Based Search with Iterative Building)** is a highly scalable, decentralized algorithm built for high-density environments.

Located in `src/solver/pibt.rs`, it stands as the primary default algorithm for large MAFIS scenes containing thousands of agents.

## How it works

PIBT does not attempt to find the optimal path to the goal. Instead:
1. Every tick, agents are assigned priorities.
2. The agent with the highest priority chooses its next immediate step (typically using greedy distance to the target).
3. If an agent wants to move into a cell occupied by a lower-priority agent, PIBT recursively forces the lower-priority agent to move out of the way.
4. If it's physically impossible (a dead end or strict collision), the agent waits.

## PIBT & Chaos Engine

Unlike CBS, PIBT natively resists Chaos. Because the "plan" is just evaluating the next immediate cell, a Breakdown Fault immediately registers as an unpathable static object in the very next frame. PIBT agents will dynamically flow around the broken robot like water around a stone, with virtually zero computational spike on the CPU.
