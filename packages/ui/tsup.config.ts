import { defineConfig } from 'tsup';

export default defineConfig((options) => ({
  entry: {
    index: 'src/index.ts',
    motion: 'src/motion/index.ts',
  },
  format: ['esm'],
  dts: true,
  sourcemap: true,
  // One-shot builds clean; watch mode must NOT wipe dist on startup, or a
  // consumer can compile against a dist that has index.js but not yet
  // index.d.ts → TS7016 across every import.
  clean: !options.watch,
  // Peers + heavy libs stay external — the consuming app provides them (deduped by pnpm).
  // clsx + tailwind-merge are tiny and bundled.
  external: ['react', 'react-dom', 'react/jsx-runtime', 'antd', 'framer-motion', 'lucide-react'],
}));
