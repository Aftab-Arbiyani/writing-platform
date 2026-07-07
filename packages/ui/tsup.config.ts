import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  // Peers stay external — the consuming app provides React and AntD.
  external: ['react', 'antd'],
});
