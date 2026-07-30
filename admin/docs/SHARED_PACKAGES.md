# Qalam Admin — Shared Package Usage

The admin app maximizes reuse of workspace packages (apps import packages, never
the reverse; packages never import apps). Nothing that belongs in a package is
reimplemented locally.

| Package                   | Role in admin                                                                                                                                                                                                                                                                 | Import breadth |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| **`@qalam/ui`**           | Design tokens (`--q-*`), AntD theme (`getAntdTheme`), primitives (`QButton`, `QInput`, `QSelect`, `QCard`, `QTag`, `QDialog`, `QDrawer`, `QSkeleton`, `QEmptyState`, `QSpinner`, `useToast`, `useConfirm`, `cn`), and `@qalam/ui/motion` (page transitions, `MotionProvider`) | ~82 files      |
| **`@qalam/shared`**       | Domain vocabulary: `Role`, `ROLE_RANK`, `PERMISSIONS`, `DEFAULT_ROLE_PERMISSIONS`, `permissionSatisfies`, `ERROR_CODES`, `UserStatus`, `ReportReason/Status`, `AnalyticsPeriod`, limits, regexes                                                                              | ~65 files      |
| **`@qalam/api-types`**    | Wire contract types (OpenAPI-generated + manual) for request/response shapes                                                                                                                                                                                                  | ~10 files      |
| **`@qalam/utils`**        | Pure helpers (formatting/date) reused where a local util would duplicate them                                                                                                                                                                                                 | 1 file         |
| **`@qalam/config`** (dev) | Shared tsconfig / eslint / prettier presets                                                                                                                                                                                                                                   | build only     |

## How reuse shows up

- **Look & feel**: every surface renders `--q-*` tokens (Tailwind theme + AntD
  `ConfigProvider`), so dark mode and RTL are correct for free. Admin never
  hard-codes hex/px.
- **Primitives over reinvention**: shared admin components (`src/components/*`)
  are thin adapters over `@qalam/ui` primitives — `modal.tsx` → `QDialog`,
  `drawer.tsx` → `QDrawer`, `empty-state.tsx` → `QEmptyState`,
  `loading-state.tsx` → `QSkeleton`/`QSectionLoader`, `stat-card`/`metric-card` →
  `QCard`. Focus-trap, Escape, and focus-return live in the `@qalam/ui`
  primitives, not in bespoke admin code.
- **Vocabulary over magic strings**: roles, permissions, error codes, statuses,
  and limits come from `@qalam/shared` — the same source the backend enforces, so
  the client can't drift from the server contract.
- **RBAC/PBAC**: `usePermissions()` derives grants from `DEFAULT_ROLE_PERMISSIONS`
  - `permissionSatisfies` (shared) — the client mirrors the server's model.

## Refactor review (A9)

The admin↔package boundary is already clean; no admin logic needs to move into a
package. The one candidate considered — the per-feature `downloadX` blob-export
helper (repeated in `users`/`audit`/`moderation`/`analytics`) — was **kept
per-feature by design**: each names its own endpoint + filename and the bodies
differ (params, format), so a shared helper would trade three lines of duplication
for a leakier abstraction. This is documented, not an oversight.
