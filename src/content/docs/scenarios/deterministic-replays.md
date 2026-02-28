---
title: External Exports & Replays
description: Recording state data continuously for exact forensic reproduction.
---

Testing chaotic multi-agent paths requires absolute confidence in recreation. MAFIS allows users to dump total state data through our `src/export` module.

## The Snapshot System

MAFIS does not just log a string of events; it gathers a complete structural `Snapshot`. A snapshot grabs agent states, heat maps, criticality metrics, and grid layouts.

```rust
pub struct FaultLogEntry {
    pub entity: Entity,
    pub fault_type: FaultType,
    pub tick: u64,
    pub position: IVec2,
}
```

## Formats Available

Using the CLI or UI Configuration, a user can trigger:

1. **JSON Export:** Dumps the entire layout, history array, and agent targets into a single portable `.json` intended for web UI rendering or Python Data Science.
2. **CSV Matrix:** Transposes agent ticks, heat maps, and grid obstructions into raw flat tables for tabular tools like R or Excel.

## Triggers

Exports are designed around three fundamental triggers:

1. **Periodic:** E.g., Snapshot the factory every 1,000 computation ticks.
2. **Fault-based:** Only dump variables to a JSON precisely at the millisecond a Breakdown occurs.
3. **Finish:** Extract all routing metrics once the final agent reaches its goal.
