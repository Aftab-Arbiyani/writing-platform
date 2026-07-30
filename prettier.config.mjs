/**
 * Canonical Prettier configuration for the Qalam monorepo.
 *
 * This file is the single source of truth for formatting. The shared preset
 * `@qalam/config/prettier` re-exports this exact shape so workspace packages
 * and external consumers resolve the same rules — if a value changes here,
 * change it there too.
 */
export default {
  semi: true,
  singleQuote: true,
  printWidth: 100,
  trailingComma: 'all',
  arrowParens: 'always',
};
