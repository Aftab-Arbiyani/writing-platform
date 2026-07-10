# Shared Package Documentation

Workspace packages (pnpm) consumed by the frontend. **Apps import packages, never the reverse;
packages never import apps.** Packages stay disjoint (docs/00 hard-rule #10).

| Package            | Purpose                                                                                                                                                                                                                              | Frontend usage                                                                                                                                                                                                                                                                           |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@qalam/shared`    | Domain vocabulary: enums, error codes (`ERROR_CODES`), limits (`COVER_IMAGE_MAX_MB`, `AVATAR_IMAGE_MAX_MB`, `ACCEPTED_IMAGE_TYPES`, `PAGE_SIZE`), regexes (`USERNAME_REGEX`), permission constants, API envelope types. Zero-dep TS. | Widely used: error-code catalogue → `lib/error-messages`; validation limits → image/form validators; enum types for query keys and DTO mirrors. **Single source of truth for limits** — never hardcode a divergent value (F10 reconciled the writing cover cap to `COVER_IMAGE_MAX_MB`). |
| `@qalam/utils`     | Pure functions only, zero-dep.                                                                                                                                                                                                       | `editor-metrics` (`countWords`, `extractPlainText`, `readingTime`).                                                                                                                                                                                                                      |
| `@qalam/api-types` | Wire contract (OpenAPI-generated + manual) — the typed shape of `v1` responses.                                                                                                                                                      | Imported where DTOs are consumed; some feature `types/` still mirror shapes locally pending full generation.                                                                                                                                                                             |
| `@qalam/ui`        | Design tokens (`--q-*`), AntD theme (`getAntdTheme`), motion (`@qalam/ui/motion`), and the `Q*` primitives. Owns the look + dark mode + base a11y.                                                                                   | Every feature. `styles/tokens.css` defines the colour tokens both Tailwind and AntD resolve from.                                                                                                                                                                                        |
| `@qalam/config`    | Shared tsconfig / eslint / prettier presets.                                                                                                                                                                                         | `eslint.config.mjs` extends `@qalam/config/eslint/react` (incl. the logical-property ban). tsconfig extends the base.                                                                                                                                                                    |

## Import discipline

- Colours/spacing → `@qalam/ui` tokens (never raw hex/px in components).
- Error codes, enums, limits → `@qalam/shared` (never redefine).
- Pure helpers reusable across apps → `@qalam/utils`; app-only helpers → `src/lib`.
- The ESLint preset (`@qalam/config`) enforces logical-property usage, import order, no `any`,
  no non-null assertions outside tests, and react-refresh component-only exports.

## Boundary example (F10)

`features/writing/lib/image-validation.ts` now imports `COVER_IMAGE_MAX_MB` from `@qalam/shared`
instead of hardcoding `15 * 1024 * 1024`, so client and server enforce the same 10 MB cap. This is
the canonical pattern: **domain limits come from `@qalam/shared`**.
