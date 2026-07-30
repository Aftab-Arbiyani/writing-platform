# Qalam Admin — Testing Guide

Tests use **Vitest + Testing Library + jsdom**, colocated as `*.spec.ts(x)` next
to the code they cover. The suite is deterministic (retries off) and runs in CI as
a deploy gate.

```bash
pnpm --filter admin test         # vitest run (all)
pnpm --filter admin exec vitest  # watch mode
```

## Harness

`src/test/render.tsx` exposes `renderWithProviders(ui, { route })`, mirroring the
app's provider stack: a fresh retry-off `QueryClient`, `HelmetProvider`, AntD
`ConfigProvider` + `App` (message/notification/modal context), and a
`MemoryRouter`. Tests **mock at the boundary we own** — the feature `api/*.ts`
layer (for hook specs) or the feature hooks (for component specs) — never the
network.

## What is covered

| Layer             | How it's tested                                                                                                                            |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **Utilities**     | Pure units — `jwt`, `format`, `errors`, `download-export`, `use-debounced-search`, `data-table`, guards                                    |
| **Hooks**         | `renderHook` with a retry-off client; assert fetch args, permission gating (admin fires / moderator idle), optimistic cache + rollback     |
| **Components**    | `renderWithProviders`; assert rendered data, states (loading/empty/error), interactions (toggle, save, filter), and PBAC-gated affordances |
| **Pages / flows** | Section switching, export (CSV/JSON) triggers, print, dialogs, bulk actions                                                                |

## Critical admin flows with coverage

- **Authentication** — login form validation/submit; role-guard + require-role
  gating; permission hook; session/JWT decode (fail-closed to least privilege).
- **Dashboard** — platform stats, health, alerts, activity widgets.
- **User management** — list/table, filters, bulk bar, edit modal, export, row
  actions, mapper.
- **Moderation** — report queue, decision dialog, row actions, statistics,
  mutations (resolve/note/reopen/appeal).
- **Reports & Audit** — audit hooks (gating), statistics, detail drawer, report
  extensions.
- **Settings** — settings form (validation/dirty/save/reset), feature-flag table
  (search/toggle/create), maintenance (confirm-on-enable), PBAC metadata.
- **Analytics** — hooks (gating), chart container states + a11y table, overview +
  system sections, filters store, filter bar (export/print), page (tab switch +
  export).

## Conventions

- Drive role via `useAuthStore.setState({ status:'authenticated', role })`.
- Charts: mock `../charts/echarts-loader` (ECharts can't run in jsdom).
- Cache assertions on observer-less queries need `gcTime: Infinity`.
- Fake timers (`vi.useFakeTimers`) for debounce; `vi.stubGlobal('fetch', …)` for
  blob-export units.

## A9 note

Dead-code specs were removed with their code; new specs were added for the two
shared utilities introduced during the A9 consolidation (`use-debounced-search`,
`download-export`). Full suite: **52 files / 153 tests, all green.**
