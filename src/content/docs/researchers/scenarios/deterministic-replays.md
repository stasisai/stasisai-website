---
title: Tick History & Rewind
description: How MAFIS records a complete simulation snapshot every fault-phase tick, how the rewind mechanism works, and how chart click-to-seek reconstructs any historical moment.
---

MAFIS records a complete snapshot of the simulation state every tick during the fault injection phase. This snapshot buffer allows you to rewind to any past tick, reconstruct the 3D scene, and step forward or backward frame-by-frame. Clicking a chart marker at the moment of a fault event seeks directly to that tick.

## Architecture: Snapshot Ring Buffer

Every tick during fault injection, the `record_tick_snapshot` system stores a complete `TickSnapshot`:

```rust
struct TickSnapshot {
    tick: u64,
    phase: SimulationPhase,
    agents: Vec<AgentSnapshot>,        // ~40 bytes/agent
    obstacle_additions: Vec<IVec2>,    // obstacles added since simulation start (diff, not full grid)
    metrics: MetricsSnapshot,          // all metric values + scorecard values
    fault_events: Vec<FaultEventRecord>, // events that fired on this tick
}

struct AgentSnapshot {
    entity_index: u32,
    pos: IVec2,
    goal: IVec2,
    heat: f32,
    is_dead: bool,
    plan_length: u16,
    last_action: Action,
    total_actions: u32,
    wait_actions: u32,
    move_actions: u32,
}
```

Snapshots are stored in `TickHistory`:

```rust
struct TickHistory {
    snapshots: Vec<TickSnapshot>,
    replay_cursor: Option<usize>,  // None = live, Some(idx) = viewing historical tick
    recording: bool,               // true during fault injection phase
}
```

> [!NOTE] Warmup ticks are **not** recorded — the warmup phase is baseline-only with no fault events to rewind to. Recording begins when the simulation transitions to `SimulationPhase::FaultInjection`.

## Memory Budget

| Component | Per Tick | 5000 Ticks |
|---|---|---|
| 500 × AgentSnapshot (40B) | 20 KB | 100 MB |
| Obstacle diff (~20 entries) | 160 B | 0.8 MB |
| MetricsSnapshot | 100 B | 0.5 MB |
| FaultEvents (rare) | ~50 B | 0.25 MB |
| **Total** | **~21 KB** | **~105 MB** |

105MB for 5000 fault-phase ticks is acceptable for a research desktop. The buffer is unbounded — it grows until the simulation ends or is stopped.

## SimState Machine

```
Start ──▶ Running ──── Pause ──▶ Paused ──── Seek ──▶ Replay
                       ◀── Resume ──                  ◀── Resume ──▶ Running
```

- **Running:** simulation advancing, snapshots recording
- **Paused:** simulation frozen, camera still interactive, manual fault injection available
- **Replay:** reading from snapshot buffer, all simulation systems inactive, 3D scene reconstructed from snapshot

> [!IMPORTANT] Resume from Replay returns to Running and continues from where the simulation was paused (not from the replayed tick). Rewind is read-only — there is no branching from a past tick.

## Chart Click-to-Seek

The throughput and fault survival charts show vertical red markers at each fault event tick. Clicking on a marker (or anywhere on the chart) triggers seek:

1. JS translates the click X coordinate to a tick number
2. JS sends `seek_to_tick { tick: N }` via bridge
3. Rust transitions `SimState` → `Replay`
4. `TickHistory.replay_cursor` = index of tick N
5. Replay rendering system reads `AgentSnapshot` values and overrides visual agent positions
6. Metrics panel shows that tick's values
7. Step buttons (◀ ▶) appear for tick-by-tick navigation

## Transport Controls

```
◀◀  ◀  ⏸/▶  ▶  ▶▶    Tick: 312 / 1847    ━━━━━━━●━━━━━━━━━
```

| Control | Action |
|---|---|
| `◀◀` | Jump to previous fault event |
| `◀` | Step back 1 tick |
| `⏸/▶` | Pause / Resume |
| `▶` | Step forward 1 tick |
| `▶▶` | Jump to next fault event |
| Scrubber | Drag to seek (Replay/Paused only) |

### Keyboard Shortcuts

| Key | Action |
|---|---|
| Space | Pause / Resume |
| → | Step forward 1 tick |
| ← | Step backward 1 tick |
| Shift+→ | Jump to next fault event |
| Shift+← | Jump to previous fault event |

## Step Behavior

- **Step forward (Paused):** Run exactly 1 full tick of the pipeline (Tick → Fault → Analysis). Return to Paused. A new snapshot is recorded.
- **Step backward (Paused or Replay):** Load previous tick's snapshot. Transition to Replay. Read-only — no new ticks are simulated.

## Manual Fault Injection While Paused

When paused, the researcher can click a robot in the 3D viewport to select it, then choose "Kill" / "Block for N ticks" / "Slow for N ticks" from the context menu. The injection fires immediately as a micro-tick while paused, updating the current snapshot. The researcher sees the cascade result in the metrics panel before resuming.

Manual faults are tagged `FaultSource::Manual` but go through the same cascade pipeline, producing scientifically comparable metrics.

## Code Location

- `src/analysis/history.rs` — `TickSnapshot`, `TickHistory`, `record_tick_snapshot`
- `src/core/state.rs` — `SimState` (Running, Paused, Replay, Finished)
- `src/render/animator.rs` — replay rendering from snapshot
- `src/ui/bridge.rs` — `seek_to_tick`, `step_backward`, `step_forward` commands
