---
title: Sim Configuration & Scenarios
description: Generating deterministic scenarios and testing models.
---

Testing paths algorithms rigorously demands repeatability. If a warehouse behaves drastically differently from run A to run B, optimization benchmarks are rendered useless.

## The Seeded RNG Engine

Instead of native system randomness which is impossible to foresee, MAFIS controls environments explicitly via the `SeededRng` construct.

Loaded primarily in `src/core/seed.rs`:

```rust
#[derive(Resource)]
pub struct SeededRng {
    pub seed: u64,
    pub rng: ChaCha8Rng,
}
```

By explicitly injecting a fixed seed, you can run a 500-agent setup with 10% obstacle density, watch the system collapse from heat buildup at Tick 852. Restarting the engine with the same Seed guarantees that identical agents start on identical tiles, move exactly identically, and trigger identical chaos states.

## Future Plans (.scen and `.map`)

Currently, MAFIS relies heavily on mathematically generated obstacle matrices based on noise thresholds and deterministic hashing. In upcoming releases, support for standard MAPF benchmark file formats—such as the MovingAI lab's `.scen` target lists and `.map` ascii grids—will be integrated to allow developers to benchmark their algorithms across proven, academic scenes.
