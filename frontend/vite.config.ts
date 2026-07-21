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
    // Modern baseline (P7.3) — evergreen browsers only; smaller output, no
    // legacy transpilation. Matches the reader/writer audience.
    target: 'es2022',
    // Sourcemaps are uploaded to Sentry release-tagged (docs/00 §9).
    sourcemap: true,
    // Surface any chunk that creeps past the initial-JS budget (docs 43 §9).
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        // Split heavy, stable vendors into their own cacheable chunks (docs/11 §9,
        // P7.3). The editor (TipTap/ProseMirror) and charts (echarts) are heavy
        // and route-isolated — giving each its own vendor chunk keeps them out of
        // the initial bundle and lets them cache independently across deploys.
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router'],
          'vendor-antd': ['antd'],
          'vendor-query': ['@tanstack/react-query'],
          'vendor-motion': ['framer-motion'],
          'vendor-editor': ['@tiptap/react', '@tiptap/starter-kit'],
        },
      },
    },
  },
});
