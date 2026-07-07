// Backend ESLint (flat config) — all rules live in the shared Nest preset from
// @qalam/config; this file only spreads it and adds local ignores.
import nest from '@qalam/config/eslint/nest';

export default [
  { ignores: ['dist/**'] },
  ...nest,
];
