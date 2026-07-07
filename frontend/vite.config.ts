import { fileURLToPath, URL } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    // Dev-only convenience: same-origin `/api` calls hit the NestJS API on :4000.
    proxy: {
      '/api': 'http://localhost:4000',
    },
  },
  build: {
    // Sourcemaps are uploaded to Sentry release-tagged (docs/00 §9).
    sourcemap: true,
  },
});
