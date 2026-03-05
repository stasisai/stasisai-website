# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Website for **Stasis AI** and its product **MAFIS** (Multi-Agent Fault Injection Simulator) — a Rust/Bevy/WASM simulator for chaos engineering in MAPF (Multi-Agent Path Finding) networks. This repo is the marketing site and documentation hub, not the simulator itself.

## Commands

```bash
npm run dev        # Dev server at localhost:4321
npm run build      # Production build to ./dist/
npm run preview    # Preview production build locally

# E2E tests (Playwright, Chromium only)
npx playwright test                    # Run all tests (auto-starts dev server)
npx playwright test tests/home.spec.ts # Run single test file
npx playwright test --headed           # Run with visible browser
```

## Architecture

**Framework**: Astro 5 (Static Site Generation) with `ClientRouter` for SPA-like view transitions.

**Layouts**:
- `src/layouts/Layout.astro` — Base layout. Defines all CSS variables (`:root` and `html.dark`), theme persistence script, SEO meta tags, Google Fonts loading.
- `src/layouts/DocsLayout.astro` — Three-column docs layout (sidebar nav + content + TOC). Handles pagination, pagefind search integration, mobile off-canvas sidebar, and code block copy buttons.

**Pages**: `src/pages/` — Astro file-based routing. Docs use `[...slug].astro` with `getStaticPaths()` from the `docs` content collection. `/simulator`, `/blog`, `/about` are WIP draft pages.

**Content**: `src/content/docs/` — Markdown files for documentation. Schema defined in `src/content.config.ts` (title, description). Navigation structure is hardcoded in `DocsLayout.astro`'s `navGroups` array — new docs must be added there manually.

**Components**:
- `src/components/Header.astro` — Fixed header (height: 70px, hardcoded). Handles theme toggle, mobile burger menu. Docs mobile sticky topbar uses `top: 70px`.
- `src/components/KineticGrid.jsx` — React + @react-three/fiber 3D visualization on homepage. Implements A* pathfinding and PIBT-style agent simulation with fault injection wave propagation. Loaded via `client:only="react"`.

## Styling Conventions

**Dual system**: Core structural CSS uses vanilla CSS with CSS variables defined in `Layout.astro`. Tailwind CSS v4 is available via Vite plugin (`src/styles/global.css`), mainly used for utility overrides and the `@theme` token bridge.

**Theme engine**: Light/Dark mode via `html.dark` class on `<html>`. In Astro components, target dark mode with `:global(html.dark) .my-class`. Theme state persists in `localStorage.theme` and survives view transitions via `astro:after-swap` event.

**Design tokens** (CSS variables):
- Backgrounds: `--bg`, `--surface` (never pure white/black — light uses `#F5F2EE`, dark uses `#111111`)
- Text: `--text`, `--text-sec`, `--dark` (inverts between themes)
- Borders: `--border`, `--dark-border`
- Fonts: `--serif` (Playfair Display), `--mono` (DM Mono), `--sans` (Inter)
- Accents: `--red` (#991B1B), `--green` (#047857)

**Typography pattern**: Headings use `var(--serif)`, labels/tags/nav use `var(--mono)` uppercase with letter-spacing, body text uses `var(--sans)`. Buttons have `border-radius: 0`.

**Dark sections**: The homepage has hardcoded dark sections (`background: #080808; color: #F0EDE9`) that are independent of the theme toggle.

## Key Patterns

- **View transitions**: All interactive scripts must use `document.addEventListener('astro:page-load', ...)` instead of `DOMContentLoaded` to work after SPA navigations. Clone-and-replace pattern used in Header.astro to avoid duplicate event listeners.
- **Homepage scroll snap**: `index.astro` uses `scroll-snap-type: y mandatory` on `.snap-container`. Each section is a snap point. Header auto-hides on scroll. Back-to-top temporarily disables snap for smooth scroll.
- **Inline scripts**: Scripts that must run before paint (theme detection) use `<script is:inline>`. Others use standard `<script>` for bundling.

## Companion Rust/WASM Project

The actual simulator being built in parallel lives at `/Users/teddyadmin/Developments/Rust/Research-Project/mapf-fis-3d`. It is a **Bevy 0.18** app compiled to WASM, intended to eventually power the `/simulator` page of this website.

**Build pipeline** (run from the Rust project root):
```bash
cargo check                                                            # ~5s type/borrow check
cargo test                                                             # ~7s logic tests
cargo build --release --target wasm32-unknown-unknown                  # WASM compile (~2-3 min)
wasm-bindgen --out-dir web --target web \
  target/wasm32-unknown-unknown/release/mapf-fis-3d.wasm              # Generate JS bindings
basic-http-server web                                                  # Serve on port 4000
```

**Integration plan**: The `web/` directory of the Rust project (`index.html`, `app.js`, generated `.js`/`.wasm` files) will be embedded into `/simulator` in this Astro site. The Bevy canvas is the central 3D viewport; HTML/CSS/JS controls are peripheral. Focus on WASM bindings and logic correctness — for UI additions use existing CSS variables and the "Scientific Instrument" aesthetic (no `border-radius` on buttons, no pure white backgrounds).

**Bevy↔JS bridge**: Rust exposes `get_simulation_state() -> String` (JSON) and `send_command(cmd: &str)` via `#[wasm_bindgen]`. JS polls at 100ms intervals. The bridge is in `src/ui/bridge.rs`.

**Solver**: PIBT (lifelong-native). CBS/LaCAM/PBS/LNS2 archived on `archive/one-shot-solvers` branch — they cannot run in lifelong mode. See `src/solver/` for `MAPFSolver` trait and `SOLVER_NAMES` registry.

**Lifelong mode**: Default and only mode. Agents continuously receive new tasks via `TaskScheduler`. `RandomScheduler` is the only scheduler currently implemented. Scheduler strategy (not solver) is the primary research variable.

**Two-phase simulation**: Every run has Warmup (faults suppressed, baseline captured) → Fault Injection (faults active, resilience metrics computed as deltas from baseline). `SimulationPhase` enum tracks current phase.

**Observatory identity**: MAFIS is a fault resilience observatory, not a solver benchmark. It measures how lifelong multi-agent systems degrade, recover, and adapt under faults. Resilience Scorecard (Robustness, Recoverability, Adaptability, Degradation Slope) is the primary output.

## CI/CD

GitHub Actions (`.github/workflows/ci.yml`): `npm audit` security scan → build → Playwright E2E. Runs on push/PR to `main` and `dev`. Node 22.
