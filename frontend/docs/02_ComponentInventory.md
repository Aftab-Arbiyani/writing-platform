# Component Inventory

Counts (F10): **8 features · 20 feature pages · 81 feature components · 22 route modules · 7 shared hooks.**
Components carry no API logic — data comes from hooks in pages; components take props.

## `@qalam/ui` design-system primitives

Imported app-wide; own the look, tokens, dark mode, and a11y contract:

`QAvatar` · `QBadge` · `QButton` (variant/size, `icon`/`iconPosition`) · `QCard` · `QDialog` ·
`QDrawer` · `QEmptyState` · `QErrorState` · `QInput` · `QLoadingOverlay` · `QPageContainer` ·
`QPageLoader` · `QPagination` · `QSearch` · `QSectionHeader` · `QSectionLoader` · `QSelect` ·
`QSkeleton` · `QSpinner` · `QTag` · `QTextArea` (+ their `*Props`). Motion primitives via
`@qalam/ui/motion` (`MotionProvider`, `pageTransition`). AntD theme via `getAntdTheme(resolved)`.

## Shared app components (`src/components`)

| Component        | Role                                                                                     |
| ---------------- | ---------------------------------------------------------------------------------------- |
| `top-bar`        | Banner landmark: brand, command-trigger, notifications bell, user-menu, theme toggle     |
| `mobile-tab-bar` | Primary `nav` on mobile (bottom tabs)                                                    |
| `footer`         | `contentinfo` landmark                                                                   |
| `skip-link`      | "Skip to content" → `#main` (first focusable)                                            |
| `offline-banner` | Passive `role="status"` notice driven by `app.store.isOnline`                            |
| `user-menu`      | Account menu; prefetches the analytics dashboard on open                                 |
| `seo`            | **(F10)** `<Seo>` — per-page meta (description, canonical, OG, Twitter, robots, JSON-LD) |

## Shared hooks (`src/hooks`)

`use-page-title` (document.title) · `use-debounce` · `use-me` (current user query) ·
`use-focus-trap` **(F10 — traps focus in custom dialogs)** · plus small utilities.

## Per-feature surfaces (pages → key components)

- **auth** — login, register, forgot/reset-password, verify-email, google-callback pages; `auth-card`,
  `google-button`, password field with `aria-pressed` toggle.
- **feed** — feed page (URL-driven tabs/filters, cursor infinite query); `feed-tabs`, `feed-filter-bar`,
  `feed-list`, `feed-rail` (complementary aside), `piece-card`, `feed-skeleton`.
- **writing** — dashboard (drafts) + editor pages; TipTap `editor` (roving-tabindex toolbar),
  `publish-sheet` (responsive drawer), `preview-view` (full-page dialog, focus-trapped), cover uploader.
- **profile** — `/@handle` page (self vs other), `profile-header`, `profile-tabs`, pieces/about,
  `follow-button`, `follow-connections-dialog`, `private-notebook`.
- **search** — search + discover pages, `command-palette` (⌘K, ARIA combobox) + `command-trigger`,
  filters, tabs, results, recent/trending.
- **notifications** — inbox page + preferences page; `notification-popover`, `notification-item`,
  filters, empty states; bell with dynamic unread count.
- **settings** — account, appearance, profile, notifications pages under a shared settings layout.
- **analytics** — dashboard + per-piece pages; `metric-card`, `overview-cards`, `growth-section`,
  `pieces-table`, `trend-badge`, `comparison-card`, `export-menu`, and the ECharts wrappers
  (`chart` base + `line/bar/donut/mini-trend`, each with an sr-only data-table fallback).

## State components

Every list/section renders a consistent trio built on shared primitives: **loading**
(`QSkeleton`/`QSectionLoader`), **empty** (`QEmptyState`), **error** (`QErrorState` with retry +
request-id disclosure). Feature-local wrappers: `analytics-states`, `search-empty-states`,
`notification-empty-states`.
