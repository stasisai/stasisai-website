// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import react from '@astrojs/react';
import pagefind from 'astro-pagefind';

import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://stasisai.dev', // Replace with your actual production domain
  integrations: [react(), pagefind(), sitemap()],
  vite: {
    plugins: [tailwindcss()],
  },
});