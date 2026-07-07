/**
 * Commitlint configuration — conventional commits enforced via the commit-msg hook.
 *
 * `scope-enum` is set to WARNING (level 1), not error: the scope list below is the
 * recommended vocabulary (kept in sync with .github/workflows/pr-title.yml), but an
 * unknown scope should not block a commit outright.
 */
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [
      1,
      'always',
      [
        // backend feature modules
        'auth',
        'users',
        'pieces',
        'taxonomy',
        'engagement',
        'collections',
        'feeds',
        'search',
        'notifications',
        'analytics',
        'moderation',
        'media',
        'prompts',
        'admin',
        // apps
        'backend',
        'frontend',
        'admin-app',
        // shared packages
        'ui',
        'shared',
        'api-types',
        'utils',
        'config',
        // cross-cutting
        'infra',
        'docs',
        'deps',
        'release',
      ],
    ],
  },
};
