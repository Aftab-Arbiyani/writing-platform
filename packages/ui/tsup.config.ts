import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    motion: 'src/motion/index.ts',
  },
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  // Peers + heavy libs stay external — the consuming app provides them (deduped by pnpm).
  // clsx + tailwind-merge are tiny and bundled.
  external: ['react', 'react-dom', 'react/jsx-runtime', 'antd', 'framer-motion', 'lucide-react'],
});
