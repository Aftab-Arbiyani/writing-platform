import { defineConfig } from 'tsup';

export default defineConfig((options) => ({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  sourcemap: true,
  // One-shot builds clean; watch mode must NOT wipe dist on startup, or a
  // consumer (backend `nest start --watch`) can compile against a dist that
  // has index.js but not yet index.d.ts → TS7016 across every import.
  clean: !options.watch,
}));
