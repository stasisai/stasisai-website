---
title: Introduction to MAFIS
description: What is MAFIS and why does it exist?
---

**MAFIS (Multi-Agent Fault Injection Simulator)** is a state-of-the-art simulator designed to run Multi-Agent Path Finding (MAPF) algorithms with built-in, real-time **Fault Injection**.

## The Problem

In industrial automation, automated guided vehicles (AGVs) in warehouses or swarms of delivery drones rely on precise algorithmic coordination. Solvers like CBS or PIBT coordinate hundreds of agents simultaneously to ensure they do not collide. 

However, in the real world, hardware fails. When a robot suffers a sudden power loss or sensor failure, it forms a dynamic obstacle. This crash forces surrounding robots to queue or recalculate their paths, often triggering a cascading latency wave throughout the entire system.

## The Solution

MAFIS exists to model exactly this scenario. By writing our engine structurally in Rust—leveraging the powerful **Bevy Engine** ECS framework—we permit researchers and engineers to:

1. **Simulate Large-scale Swarms:** View the simulation natively leveraging compiled Rust performance without bottlenecking.
2. **Inject Faults:** Programmatically kill agents or inject deterministic faults to study system resilience.
3. **Analyze Recovery:** Understand bottleneck propagation in real time.

Proceed to the [Architecture Overview](/getting-started/architecture/) to learn how the pieces fit together.
