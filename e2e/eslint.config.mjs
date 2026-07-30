// E2E ESLint (flat config) — shared base preset from @qalam/config plus local ignores.
import base from '@qalam/config/eslint/base';

export default [
  { ignores: ['test-results/**', 'playwright-report/**', 'blob-report/**', '.auth/**'] },
  ...base,
];
