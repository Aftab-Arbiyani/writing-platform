/**
 * React (Vite) ESLint preset: base + hooks correctness + fast-refresh safety.
 *
 * The react-hooks rules are registered manually rather than by spreading the
 * plugin's own flat preset, so the exact rule set and severities are explicit
 * and stable across plugin minor versions.
 */
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import base from './base.mjs';

export default [
  ...base,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.browser },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      // Vite fast refresh needs component-only modules; allowConstantExport
      // permits `export const x = 1` alongside a component without a warning.
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
];
