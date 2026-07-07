/**
 * @qalam/config — base ESLint flat config (ESLint 9).
 *
 * Uses the plain `recommended` typescript-eslint preset — deliberately NOT the
 * type-checked variant — so lint stays fast in CI (no full `tsc` program build).
 * Packages that want type-aware rules can layer
 * `tseslint.configs.recommendedTypeChecked` on top of this locally later.
 */
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default [
  // Build output and tool caches are never linted.
  {
    ignores: ['**/dist/**', '**/.turbo/**', '**/coverage/**', '**/node_modules/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // Structured logging only; warn/error stay available for genuine failures.
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
];
