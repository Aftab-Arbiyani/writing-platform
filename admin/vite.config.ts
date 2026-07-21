import { fileURLToPath, URL } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Admin panel dev server runs on 5174 (frontend owns 5173) — see docs/00 §10.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5174,
    strictPort: true,
    proxy: {
      // Same-origin dev proxy to the NestJS API (avoids CORS when
      // VITE_API_URL is set to a relative /api/v1 base).
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
  build: {
    // Modern baseline (P7.3) — staff panel, evergreen browsers only.
    target: 'es2022',
    // Sourcemaps for Sentry release-tagged uploads (docs/00 §9).
    sourcemap: true,
    // AntD is an intentionally large, long-cached vendor chunk (~300 kB gzip);
    // raise the advisory limit above it so the build stays warning-free (A9).
    chunkSizeWarningLimit: 1100,
    rollupOptions: {
      output: {
        // Split heavy, stable vendors into their own long-cacheable chunks (docs/11 §9).
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router'],
          'vendor-antd': ['antd', '@ant-design/icons'],
          'vendor-query': ['@tanstack/react-query'],
          'vendor-motion': ['framer-motion'],
        },
      },
    },
  },
});
