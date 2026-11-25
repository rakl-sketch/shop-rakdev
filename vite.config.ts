import { copyFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages SPA fallback: 404.html = salinan index.html.
const spaFallback = (): Plugin => ({
  name: 'spa-404-fallback',
  apply: 'build',
  closeBundle() {
    copyFileSync(resolve('dist/index.html'), resolve('dist/404.html'));
  },
});

// Custom domain memakai root path.
export default defineConfig({
  base: process.env.BASE_PATH || '/',
  plugins: [react(), spaFallback()],
  build: { sourcemap: false },
});
