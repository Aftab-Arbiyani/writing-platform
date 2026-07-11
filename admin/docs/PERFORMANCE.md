# Qalam Admin — Performance Guide

The admin app is optimized for a fast, cache-friendly production load. This guide
documents the strategies in place and the audit result (A9).

## Bundle & code splitting

- **Route splitting** — every section is a `lazy()` route module; one JS chunk per
  admin area (`dashboard`, `users`, `reports`, `settings`, `analytics`,
  `audit-logs`, …). The initial load never pulls a section the operator hasn't
  visited.
- **Sub-surface lazy loading** — the six analytics sections are each `React.lazy`;
  Settings' Feature-Flags and Maintenance surfaces are lazy — all behind
  `Suspense` with skeleton fallbacks.
- **ECharts is fully lazy + tree-shaken** — `charts/echarts-loader.ts` dynamically
  imports only `echarts/core|charts|components|renderers` and registers only the
  chart/component modules used, behind a memoized singleton promise. ECharts is
  never in the main bundle; it loads only when the analytics dashboard mounts a
  chart, in its own on-demand chunks.
- **Manual vendor chunks** for long-term caching (`vite.config.ts`):
  `vendor-react`, `vendor-antd`, `vendor-query`, `vendor-motion`. AntD is the
  largest vendor (~300 kB gzip) — expected for an AntD-heavy console, and cached
  across every route. (`chunkSizeWarningLimit` is raised above it so the build is
  warning-free.)
- **Tree-shaking is clean** — AntD and lucide use named per-component imports; no
  deep-default or whole-namespace imports.

## Rendering

- **Memoized chart options** (`useMemo`) + `memo(EChartBase)`; the base chart
  disposes on unmount and resizes via `ResizeObserver`.
- **Zustand selectors select primitives** (`state => state.x`), never the whole
  store — components re-render only on the slice they read.
- **Memoized filter object** — `useAnalyticsFilterValues` selects primitives then
  `useMemo`s the object, so passing it into a query hook never churns the key.
- **URL-driven list state** keeps re-renders local to the affected surface.

## Data / query performance

- Central query defaults: `staleTime` 30 s, **`refetchOnWindowFocus: false`**,
  **4xx never retried** (else ≤2), mutations `retry: false`.
- **`keepPreviousData`** on every paginated/filtered list — no blanking between
  pages/filters. Per-hook `staleTime` tuned 15 s–5 min by volatility.
- **AbortController** threaded through every read (`{ signal }`), so navigation
  cancels in-flight requests.
- **Independent caches** per section/widget → parallel fetches, isolated
  invalidation.
- Polling is restrained: only two 30 s `refetchInterval`s (system health + live
  system analytics). React Query Devtools are DEV-only.

## Assets

- Fonts self-hosted via `@fontsource-variable/inter` (single import, no CDN
  round-trip, no layout shift).
- No images in `src/`; `public/` is a single small `favicon.svg`. Media is loaded
  from `VITE_CDN_URL` on demand.

## Virtualization

The shared `DataTable` exposes `virtual`/`scrollY`. It is intentionally **off** —
every list paginates at 20 rows/page, so a virtualized viewport isn't needed. The
capability is available if a future unbounded list appears.

## Audit result (A9)

The performance audit found **no P1 issues** — route/section/ECharts splitting,
memoized chart options, query caching, abort, and tree-shaking are all in place.
Two low-impact items were reviewed and deliberately **deferred** (they carry more
change-risk than benefit on 20-row pages): memoizing the AntD column builders on
the three list pages, and hoisting inline chart data arrays. `framer-motion` is
retained — it powers the shared reduced-motion page transition (`@qalam/ui/motion`)
and is a cached vendor chunk; removing it would be a cross-package behavior change.
