# @qalam/ui

The look of Qalam, and nothing else (charter: `docs/08_ComponentLibrary.md`).

- `styles/tokens.css` — the `--q-*` design tokens (light + `[data-theme='dark']`).
  **Single source of truth** for color, type, spacing, radii, elevation, motion.
- `styles/tailwind.css` — Tailwind v4 `@theme inline` bridge: `bg-canvas`,
  `text-ink`, `text-ink-secondary`, `border-line`, `text-accent`, `font-serif`, …
- `getAntdTheme(mode)` — AntD `ThemeConfig` derived from the same palette for
  `<ConfigProvider>`.

Shared primitives (QButton, PieceCard, ClapButton, …) arrive in Phase 1 per the
component charter. Hard boundaries: no fetch, no router, no stores — presentational
code only. RTL: logical properties exclusively; every surface must pass in dark mode.
