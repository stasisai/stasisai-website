---
title: Quick Start
description: Prerequisites, build commands, and how to run the MAFIS Rust/WASM simulator locally.
---

Follow these steps to build and run the MAFIS simulator locally.

## Prerequisites

- **Rust** (latest stable toolchain via `rustup`)
- **wasm-bindgen-cli** — `cargo install wasm-bindgen-cli`
- **basic-http-server** — `cargo install basic-http-server`
- The `wasm32-unknown-unknown` target — `rustup target add wasm32-unknown-unknown`

> [!WARNING] On Linux, Bevy requires some native libraries (alsa, udev, wayland). On macOS and Windows these are typically available without extra steps.

## Clone the Simulator Repository

```bash
git clone https://github.com/stasisai/mafis.git
cd mafis
```

## Development Workflow

For iterating on logic without a WASM build:

```bash
cargo check          # Type and borrow check (~5s)
cargo test           # Run all unit and integration tests (~7s)
```

## WASM Build (Full Simulator)

```bash
# 1. Compile to WASM (~2–3 min)
cargo build --release --target wasm32-unknown-unknown

# 2. Generate JS bindings
wasm-bindgen --out-dir web --target web \
  target/wasm32-unknown-unknown/release/mapf-fis-3d.wasm

# 3. Serve locally
basic-http-server web
```

> [!TIP] The simulator is now running at `http://localhost:4000`. The WASM build takes 2-3 minutes on the first compile. Subsequent builds with incremental compilation are much faster.

## Directory Structure After Build

```
web/
  index.html       HTML shell with Bevy canvas
  app.js           JS control layer (UI bindings, bridge polling)
  styles.css       UI styling
  mapf_fis_3d.js   Generated wasm-bindgen bindings
  mapf_fis_3d_bg.wasm  Compiled WASM module
```

## Running the Simulator

Open `http://localhost:4000`. The Bevy canvas occupies the central viewport. The HTML/CSS/JS control layer provides configuration panels, charts, and transport controls.

**Default configuration:**
- Solver: PIBT (lifelong mode, no toggle)
- Scheduler: Random
- Agents: 50
- Grid: 32×32, ~20% obstacle density
- Fault intensity: Low
- Warmup: 200 ticks

Press **Start** to begin. The header shows `WARMUP (tick/200)` during baseline collection, then `FAULTS ACTIVE (tick N)` once fault injection begins.

## Integration with the Website

The `web/` directory will be embedded into the `/simulator` page of the Astro website. The Bevy canvas is the central viewport; the surrounding HTML/CSS/JS controls are peripheral. When integrating:

- Use the CSS variables defined in `src/layouts/Layout.astro` (`--bg`, `--surface`, `--text`, `--red`, `--green`, etc.)
- Follow the "Scientific Instrument" aesthetic: no `border-radius` on buttons, no pure white backgrounds
- All JS controls communicate with Rust exclusively via `get_simulation_state()` / `send_command()` — see [Architecture](/docs/developers/getting-started/architecture)
