---
title: CBS (Conflict-Based Search)
description: The optimal multi-agent centralized solver.
---

**Conflict-Based Search (CBS)** is the gold standard for finding the absolute optimal, collision-free path for a set of agents.

Implemented in `src/solver/cbs.rs`, MAFIS features a centralized CBS architect that solves paths globally.

## The Two-Level Search

CBS operates using a multi-layered approach:

1. **High-Level Search:** Builds a Constraint Tree (CT). Each node in the tree contains a set of constraints (e.g., "Agent 1 cannot be at `(x, y)` at tick `t`"). The solver explores this tree to resolve all conflicts.
2. **Low-Level Search:** Uses a time-space A* implementation to find the shortest path for individual agents while strictly respecting the constraints mandated by the High-Level node.

## Scalability and Faults

Because CBS guarantees optimality, it is computationally expensive. 

When a **Breakdown Fault** occurs in MAFIS, the global optimal plan becomes invalid. Re-running CBS for hundreds of agents mid-simulation can result in significant framerate stutter. Thus, MAFIS allows researchers to study the specific latency introduced when a purely optimal solver is forced to replan on the fly versus a suboptimal reactive solver like PIBT.
