/**
 * Shared Prettier preset for the Qalam monorepo.
 *
 * Canonical shape mirrors the root `prettier.config.mjs` (the single source of
 * truth for formatting) — if a value changes there, change it here too.
 */
export default {
  semi: true,
  singleQuote: true,
  printWidth: 100,
  trailingComma: 'all',
  arrowParens: 'always',
};
