---
title: PIBT — Priority Inheritance with Backtracking
description: PIBT is the primary solver in MAFIS — a decentralized, reactive, one-step-at-a-time MAPF algorithm that is natively suited to lifelong operation and fault injection.
---

**PIBT** (Priority Inheritance with Backtracking) is the primary and only active solver in MAFIS. It is a decentralized, real-time MAPF algorithm that plans one step at a time — a property that makes it naturally suited to lifelong operation, dynamic obstacle creation from faults, and continuous goal reassignment.

**Reference:** Okumura et al., "Priority Inheritance with Backtracking for Iterative Multi-agent Path Finding" (AAAI 2019)

| Property | Value |
|---|---|
| Optimality | Suboptimal |
| Completeness | No (can loop in pathological cases) |
| Complexity | O(n log n) per timestep |
| Scalability | High (1000+ agents) |
| Lifelong-native | Yes |

## Why PIBT is the Right Solver for MAFIS

PIBT plans **one step at a time**, never committing to a full path. This is exactly what lifelong fault resilience research requires:

- When an agent dies and becomes a permanent obstacle, PIBT automatically routes around it on the next step — no special fault-handling code needed.
- When an agent completes a task and receives a new goal, PIBT replans from the new configuration without any stateful path history to discard.
- At 1000+ agents, PIBT runs in ~1–2ms per tick, well within the frame budget.

> [!TIP] One-shot solvers (CBS, LaCAM, PBS, LNS2) plan complete paths from start to goal and then stop. They cannot physically run in lifelong mode and produce non-actionable fault resilience results. They are archived on the `archive/one-shot-solvers` branch.

## How PIBT Works

### Priority Assignment

Each agent carries a priority value. Initially, priority = BFS distance from the agent's start to its goal. Every tick that an agent is not at its goal, its priority increments by 1.0 (priority aging). This ensures that stuck agents eventually get highest priority.

### One-Step Planning

Each tick:

1. Sort all agents by priority descending (highest first).
2. For each agent in priority order:
   - Generate candidates: 4 cardinal neighbors + wait, sorted by BFS distance to goal ascending.
   - For each candidate cell:
     - If the cell is free and unclaimed: claim it, done.
     - If the cell is occupied by an undecided lower-priority agent: trigger **priority inheritance** — the blocker inherits the mover's priority and recursively tries to move away. If the blocker succeeds, the mover claims the cell. If not, try the next candidate.
     - If the cell is claimed or permanently blocked: skip.
   - If all candidates fail: wait in place.

### Priority Inheritance

This is PIBT's key mechanism. When high-priority agent A wants the cell of low-priority agent B:

```
A (priority 10) wants cell of B (priority 3)
→ B inherits priority 10
→ B recursively tries to move away (with priority 10)
→ If B succeeds: A moves into B's old cell
→ If B fails: A tries its next candidate
```

This creates a chain of "push" operations that propagate through congested areas and naturally resolve local conflicts without global coordination.

## Algorithm

```
function PIBT_ONE_STEP(positions, goals, grid, priorities):
    order = sort agents by priority descending

    for i in order:
        PIBT_ASSIGN(i, positions, goals, grid, priorities)

    return actions

function PIBT_ASSIGN(agent, ...):
    candidates = walkable_neighbors(agent.pos) + [agent.pos]
    sort candidates by dist_to_goal ascending

    for candidate in candidates:
        if next_occ[candidate] exists: skip  // vertex conflict
        if swap conflict with decided agent: skip

        blocker = current_occ[candidate] if undecided
        if blocker exists and blocker.priority < agent.priority:
            claim candidate for agent
            blocker.priority = agent.priority
            if PIBT_ASSIGN(blocker, ...): return true
            unclaim candidate           // undo if blocker couldn't move
            restore blocker.priority
            continue

        claim candidate for agent       // cell is free
        return true

    claim current position              // all candidates failed: wait
    return false
```

## Spatial Indexing

Collision checks use `HashMap<IVec2, usize>` for O(1) lookups:
- `current_occ`: maps each cell to the agent currently occupying it
- `next_occ`: maps each cell to the agent that has claimed it for the next step

This replaces naive O(n) scans, keeping PIBT at O(n log n) even at 1000+ agents.

## Constrained Mode

`pibt_one_step_constrained` accepts `constraints: &[(usize, IVec2)]` — pre-decided agent→vertex assignments. These agents are fixed before PIBT runs, and unconstrained agents treat these positions as obstacles. This extension point allows future solvers (e.g., RHCR) to use PIBT as a low-level subroutine.

## Incompleteness

PIBT is incomplete — it can fail to find a solution even when one exists:

- **Livelock:** Two agents facing each other in a narrow corridor may repeatedly swap priority without progress.
- **No global coordination:** Each step is locally greedy with no mechanism to coordinate detours across timesteps.
- **Priority aging mitigates but does not guarantee:** Stuck agents eventually get high priority, but may still be blocked by geometry.

> [!NOTE] In practice, PIBT works reliably on open grids and moderate obstacle densities. Its incompleteness is acceptable for fault resilience research — what matters is the observable behavior of the fleet, not whether every theoretical solution is found.

## Complexity

| Aspect | Complexity |
|---|---|
| Agent priority sort | O(n log n) |
| Per-agent assignment | O(5 candidates × O(1) lookup) |
| Inheritance chain | O(n) worst case |
| **Per timestep** | **O(n log n)** |
| Memory | O(n) spatial indices + O(n × T) paths |

## Code Location

- `src/solver/pibt.rs` — `PibtSolver`, `pibt_one_step`, `pibt_one_step_constrained`, `pibt_assign`
- `src/solver/heuristics.rs` — `DistanceMap` (BFS flood-fill, O(1) lookups)
- `src/solver/traits.rs` — `MAPFSolver` trait
