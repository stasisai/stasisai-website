# Stasis AI Website - AI Assist Context

This document serves as the long-term memory for AI coding assistants working on this repository.

## 1. Project Entities
- **Stasis AI**: The organizational identity / fictional company.
- **MAFIS (Multi-Agent Fault Injection Simulator)**: The core product. It is a high-performance simulator written in **Rust** using the **Bevy Engine ECS**, compiled to WebAssembly (WASM). It simulates chaos, hardware breakdowns, and heat/congestion in Multi-Agent Path Finding (MAPF) networks.

## 2. Tech Stack & Architecture
- **Framework**: Astro (Static Site Generation + View Transitions).
- **Styling**: Vanilla CSS with strict CSS Variables for theming (No Tailwind for core structural UI).
- **Interactivity / 3D**: React and `@react-three/fiber` (used notably for the `KineticGrid` component on the homepage).
- **Search**: `astro-pagefind` integrated into the documentation.
- **Testing**: Playwright (E2E workflows already configured).
- **CI / Delivery**: GitHub Actions configured; targeted for deployment on Vercel (Hobby tear).
- **Design Guidelines**: The project strictly adheres to the `@tech-editorial-ui` skill layout conventions (minimalist, sophisticated text contrasts).

## 3. UI/UX Rules & Conventions
- **Theme Engine**: The site heavily uses Light/Dark mode. The dark class `.dark` is applied to the root `<html>`.
- **CSS Variables**: Core colors (`--bg`, `--surface`, `--text`, `--dark-border`, etc.) are defined in `src/layouts/Layout.astro`. 
  - *Note:* Dark mode uses a soft anthracite `#111111` for `--bg` and `#E2DFDB` for `--text` to prevent eye strain. Avoid pure black/white.
- **Fixed Dimensions**: The main site header (`Header.astro`) is explicitly locked at `height: 70px`. Mobile sticky elements (like the docs topbar) must use `top: 70px` to flush perfectly without gaps.
- **WIP Pages**: `/simulator`, `/blog`, and `/about` are currently Draft/WIP pages equipped with a generic scaffold.

## 4. Documentation Map (`src/content/docs/`)
The docs mirror the actual Rust MAFIS repository structure:
- `/getting-started`: Intro, Architecture, Quick Start
- `/engine-ecs`: Agent Components, Core Design, Grid Structures
- `/solvers`: A* (A-Star), CBS, PIBT, LaCAM (Lazy Constraints Addition Search)
- `/fault-engine`: Chaos Engineering, Breakdown Faults, Heat Mechanics
- `/scenarios`: Scenario Loading, Deterministic Replays

## 5. Next Steps for Next AI Session
- Continue migrating the actual WASM implementation into the `/simulator` page.
- Focus strictly on logic, performance, and WASM bindings. 
- For any UI additions, rely entirely on existing CSS variables and the `@tech-editorial-ui` aesthetic profile.
