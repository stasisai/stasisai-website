---
title: Cascade Propagation
description: How MAFIS traces the ripple effect of a fault through the agent fleet — the Agent Dependency Graph (ADG), BFS cascade, and replanning pipeline.
---

When a fault occurs — an agent dies, a cell becomes blocked — the agents whose paths cross the new obstacle cannot continue. But the disruption does not stop with those directly blocked agents. Their replanned paths may in turn block other agents, who block others still. This chain reaction is **cascade propagation**, and it is one of the core research outputs MAFIS is designed to measure.

## Agent Dependency Graph (ADG)

The cascade pipeline starts with an **Agent Dependency Graph**. When a fault creates a new obstacle at position P:

1. Identify all agents whose current planned paths pass through P (direct dependents).
2. For each direct dependent, compute their new path around P.
3. For each new path, check whether it now conflicts with any other agent's current path.
4. Add those agents to the dependency queue (indirect dependents).
5. Repeat until no new conflicts are found.

> [!IMPORTANT] The ADG captures the full transitive closure of the disruption. **Cascade depth** is the maximum depth of this graph for any single fault event. **Cascade spread** is the total number of nodes (agents affected).



## BFS Cascade

The cascade is computed via BFS from the fault origin:

```
Level 0: fault origin (dead agent or blocked cell)
Level 1: agents whose planned paths pass through the obstacle
Level 2: agents whose paths conflict with Level 1's new plans
Level 3: agents whose paths conflict with Level 2's new plans
...
```

BFS terminates when no new conflicts are introduced at a given level. The depth is the number of levels reached.

In MAFIS, this is implemented in `propagate_cascade` (`src/fault/breakdown.rs`), which runs in `FaultSet::FaultCheck` before the replan phase.

## FaultEventRecord

Each fault event is recorded as a `FaultEventRecord` with impact data filled progressively:

```rust
struct FaultEventRecord {
    id: u32,
    tick: u64,
    fault_type: FaultType,
    source: FaultSource,
    entity: Entity,
    position: IVec2,

    agents_affected: u32,       // cascade spread
    cascade_depth: u32,
    throughput_at_fault: f32,   // throughput the tick before
    throughput_min_after: f32,  // lowest throughput in recovery window
    throughput_delta_pct: f32,  // percentage drop

    recovery_start_tick: Option<u64>,
    recovery_end_tick: Option<u64>,
    recovery_duration: Option<u64>,
    recovered: bool,
}
```

`agents_affected` and `cascade_depth` are set immediately when the cascade BFS completes. The throughput and recovery fields are filled over the following ticks as recovery unfolds.

## Replan Phase

After the cascade is computed, `FaultSet::Replan` triggers replanning for all affected agents. PIBT replans from current positions with the updated grid (which now reflects the new obstacle). Because PIBT is reactive and one-step-at-a-time, replanning is fast — typically 1–2ms for 500 agents.

The `FaultSet::Replan` phase runs after `FaultSet::FaultCheck` in every tick:

```
FixedUpdate (SimState::Running):
  CoreSet::Tick
  FaultSet::Heat
  FaultSet::FaultCheck    ← cascade computed here
  FaultSet::Replan        ← affected agents replanned here
  CoreSet::PostTick
  AnalysisSet::Metrics    ← MTTR, cascade metrics written here
```

## Why Cascade Metrics Matter for Research

In lifelong mode, cascade depth and spread are driven primarily by **scheduler strategy** and **corridor topology**:

- A scheduler that assigns tasks concentrating agents in narrow corridors produces high cascade depth (blocked agents form long chains) and high spread (many agents share the same chokepoint).
- A scheduler that distributes agents broadly produces lower cascade depth and spread, at the cost of potentially lower baseline throughput.

> [!TIP] This trade-off — baseline efficiency vs fault resilience — is the core research question MAFIS is designed to quantify. Two configurations can have identical baseline throughput but completely different cascade profiles, which only becomes visible under fault injection.

See [Fault Types](/docs/researchers/fault-mechanics/chaos-engineering) for the full fault taxonomy, and [Fault Metrics](/docs/researchers/metrics/fault-metrics) for the full set of metrics computed per event.
