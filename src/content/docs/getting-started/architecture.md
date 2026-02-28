---
title: MAFIS Architecture
description: Overview of the Multi-Agent Fault Injection Simulator stack.
---

MAFIS natively relies on a modern, deeply optimized systems programming stack tailored to large-scale operations.

## 1. Core State & Simulation Box

The core `src/core` module holds everything dictating space, time, and matter.
It wraps the `Grid` (a matrix representing 2D nodes), `Action` enums (movements like North, South, Wait), and `LogicalAgent` configurations.

The simulation runs tightly through isolated System Sets ensuring deterministic execution orders: Physics first, Faults second, Replanning third. 

## 2. Solver Plugins

Defined in `src/solver`, these are purely abstract blocks:
* **`pibt.rs`**: Fast, reactive, default for thousands of nodes.
* **`cbs.rs`**: Exhaustive, globally-optimal conflict tree.
* **`lacam.rs`**: Lazy, hybrid approach.
* **`astar.rs`**: Universal primitive line-finding.

Being modular, a user can dynamically swap `PIBT` to `CBS` mid-simulation if required.

## 3. The Fault Engine

This is where MAFIS distinguishes itself from purely static theoretical benchmarks. Located in `src/fault`, the chaos engine listens over the simulation.

* **`breakdown.rs`**: Determines if a specific `Entity` suffers a hardware death based on injected math hooks.
* **`heat.rs`**: Calculates thermal buildup per cell. Standing still in a cluster builds heat, eventually triggering Overheat faults.

## 4. UI & Rendering

The presentation layer. Kept strictly agnostic from the `core`.
* **`ui/`**: Egui menus and statistical interfaces bridged natively into Bevy.
* **`render/`**: 3D geometric interpretation of mathematical grids. Converts a `LogicalAgent` at `IVec2(5, 5)` into a glowing 3D cube mesh with interpolated animations (`animator.rs`), enabling humans to passively view algorithmic breakdowns in 60fps instead of reading raw CSV logs.
