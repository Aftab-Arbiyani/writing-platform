/**
 * Root ESLint flat config — global ignores ONLY.
 *
 * Linting is a per-workspace concern: backend, frontend, admin, and packages/*
 * each own an eslint.config that extends the shared presets from @qalam/config.
 * This root file exists solely so editors opening the repo root do not error on
 * paths that belong to no workspace. Do not add rules here.
 */
export default [
  {
    ignores: ['**/node_modules/**', '**/dist/**', '**/.turbo/**', '**/coverage/**', 'docs/**'],
  },
];
