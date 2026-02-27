// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

import tailwindcss from '@tailwindcss/vite';
import react from '@astrojs/react';

// https://astro.build/config
export default defineConfig({
  integrations: [starlight({
    title: 'Stasis AI Docs',
    customCss: ['./src/styles/global.css'],
    social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/stasisai/stasisai-website' }],
    sidebar: [
      {
        label: 'Getting Started',
        items: [
          { label: 'Introduction', slug: 'getting-started/introduction' },
          { label: 'Architecture', slug: 'getting-started/architecture' },
          { label: 'Quick Start', slug: 'getting-started/quick-start' }
        ],
      },
      {
        label: 'Engine & ECS (Bevy)',
        items: [
          { label: 'Core ECS Design', slug: 'engine-ecs/core-design' },
          { label: 'Agent Components', slug: 'engine-ecs/agent-components' },
          { label: 'Grid Structures', slug: 'engine-ecs/grid-structures' }
        ],
      },
      {
        label: 'MAPF Solvers',
        items: [
          { label: 'CBS (Conflict-Based Search)', slug: 'solvers/cbs' },
          { label: 'A* Space-Time', slug: 'solvers/astar-space-time' },
          { label: 'PIBT', slug: 'solvers/pibt' }
        ],
      },
      {
        label: 'Fault Injection Mechanics',
        items: [
          { label: 'Chaos Engineering', slug: 'fault-engine/chaos-engineering' },
          { label: 'Crash Faults', slug: 'fault-engine/crash-faults' },
          { label: 'Delay Faults', slug: 'fault-engine/delay-faults' }
        ],
      },
      {
        label: 'Scenarios & Replays',
        items: [
          { label: 'Scenario Loading', slug: 'scenarios/scenario-loading' },
          { label: 'Deterministic Replays', slug: 'scenarios/deterministic-replays' }
        ]
      },
    ],
  }), react()],

  vite: {
    plugins: [tailwindcss()],
  },
});