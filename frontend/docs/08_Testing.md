# Testing Guide

## Tooling

- **Vitest** (`environment: jsdom`, `globals: true`) + **@testing-library/react** + **jest-dom**.
- Setup: `src/test/setup.ts` polyfills `matchMedia` and `ResizeObserver` (jsdom gaps).
- Harness: `src/test/render.tsx` → `renderWithProviders(ui, { route })` mirrors the app provider
  stack: `HelmetProvider` → `QueryClient` (retries off, `gcTime: 0` — deterministic) → AntD
  `ConfigProvider` + `App` (for `useToast`/`useConfirm`) → `MemoryRouter`.

## Philosophy

- **Mock the feature `api/` layer**, not the network (no MSW). The `api/` boundary is what we own
  (docs/32 §10); tests stub it and assert component/hook behaviour against the returned envelope.
- Test **behaviour and a11y**, not implementation. Charts are asserted via their sr-only data-table
  (jsdom can't render canvas); `chart-core` (ECharts) is mocked in chart tests.
- Services/guards/utils/stores: unit-tested. Pages: integration-tested through the harness.

## What's covered (snapshot)

**65 spec files · 254 tests, all green.** Representative coverage by area:

| Area             | Examples                                                                                                                                           |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Auth             | `session.spec`, guards, auth pages                                                                                                                 |
| Writing          | editor UI store, `image-validation.spec`, publish flow, preview                                                                                    |
| Reading/Feed     | feed list/tabs/filters, piece-card                                                                                                                 |
| Search           | command-palette, filters, results, recent/trending, `platform` (⌘/Ctrl)                                                                            |
| Notifications    | store, popover, inbox, preferences                                                                                                                 |
| Analytics        | dashboard + piece pages, charts (`chart.spec`), export, date-range, overview cards, format/derive libs                                             |
| Profile/Settings | profile page (self/other/restricted), edit-profile, account, appearance                                                                            |
| Cross-cutting    | `providers.spec`, `routes.spec`, `format.spec`, **`seo.spec`**, **`seo` component spec**, **`use-focus-trap.spec`**, **`use-install-prompt.spec`** |

F10 added 15 tests: SEO helpers + `<Seo>` meta emission, the focus-trap hook (focus-in, Tab cycle,
restore-on-close), and the install-prompt hook (availability, choice, appinstalled).

## Running

```bash
pnpm --filter frontend test                 # full run
pnpm --filter frontend exec vitest <path>   # a file/dir
pnpm --filter frontend exec vitest --watch  # watch mode
```

> A `test:coverage` script is intentionally omitted: `@vitest/coverage-v8` is not installed. Add it
> as a devDependency and wire `vitest run --coverage` when a coverage gate is wanted.

## Adding tests (checklist)

1. Co-locate `*.spec.ts(x)` next to the unit.
2. Use `renderWithProviders` for anything touching Query/AntD/Router/Helmet.
3. Mock the feature `api/` module; assert loading → data → empty → error states.
4. For a11y: assert labels/roles and (for charts) the data-table alternative.
5. Keep tests deterministic — no real timers/network; use `vi.useFakeTimers()` where timing matters.
