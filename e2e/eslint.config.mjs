// E2E ESLint (flat config) — shared base preset from @umberleaf/config plus local ignores.
import base from '@umberleaf/config/eslint/base';

export default [
  { ignores: ['test-results/**', 'playwright-report/**', 'blob-report/**', '.auth/**'] },
  ...base,
];
