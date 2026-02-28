// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import react from '@astrojs/react';
import pagefind from 'astro-pagefind';

// https://astro.build/config
export default defineConfig({
  integrations: [react(), pagefind()],
  vite: {
    plugins: [tailwindcss()],
  },
});