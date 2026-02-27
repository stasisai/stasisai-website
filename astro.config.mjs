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
        label: 'Core MAPF Solvers',
        items: [
          { label: 'CBS (Conflict-Based Search)', slug: 'solvers/cbs' },
          { label: 'PIBT (Priority Inheritance)', slug: 'solvers/pibt' },
          { label: 'LaCAM', slug: 'solvers/lacam' }
        ],
      },
      {
        label: 'Fault Injection Engine',
        items: [
          { label: 'Fault Models', slug: 'fault-engine/models' },
          { label: 'Contagion Logic', slug: 'fault-engine/contagion' },
          { label: 'Metrics & Profiling', slug: 'fault-engine/metrics' }
        ],
      },
      {
        label: 'API & Configuration',
        autogenerate: { directory: 'reference' },
      },
    ],
  }), react()],

  vite: {
    plugins: [tailwindcss()],
  },
});