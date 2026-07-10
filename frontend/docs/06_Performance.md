# Performance Guide

## Code-splitting & lazy loading

- **Every route is lazy** (`app/router.tsx`: `lazy: () => import('@/app/routes/*')`). Route chunks are
  small (e.g. `stats` ~13 kB, `piece-stats` ~5 kB, `discover` ~5 kB gzip ≈ 2 kB).
- **ECharts is isolated** in `chart-core` (~554 kB raw / ~190 kB gzip) and dynamic-imported by the base
  `Chart` wrapper — it never enters the main bundle; only analytics routes pay for it, on demand.
- **The publish/editor schema** (`publish.schema`, ~396 kB) is split to the writing route.
- **Vendor chunks** (`vendor-react`, `vendor-antd`, `vendor-query`, `vendor-motion`) are separated in
  `vite.config.ts` for long-term browser caching across deploys.

The Vite "chunk > 500 kB" note refers to the already-lazy `chart-core`, `vendor-antd`, and
`publish.schema` — none are in the initial load path. This is expected, not a regression.

## Query caching & network

- **TanStack Query** owns all server state. Cache tiers follow `docs/12`; analytics use a Content-tier
  5-min `staleTime`. `retry: false` in tests for determinism; production uses default retry.
- **Request dedup** — Query dedupes concurrent identical keys; keys are centralised in `lib/query-keys.ts`.
- **AbortSignal** — every `api/` read threads the query's `signal`, so navigations cancel in-flight
  requests.
- **Prefetch** — the analytics dashboard is prefetched when the user-menu opens (`prefetchDashboard`).
- **Background refetch & reconnect** — Query refetches stale data on focus/reconnect; `app.store`
  tracks `online/offline` (drives the offline banner) so the UI reflects connectivity.
- **Infinite queries** — feeds/lists use cursor pagination (`getPage`), not offset, avoiding
  deep-page cost.

## Rendering

- Narrow Zustand selectors (`useStore(s => s.field)`) avoid store-wide re-renders (documented in stores).
- Charts memoise option builders and dispose ECharts instances on unmount; a `ResizeObserver` drives
  responsive resize without React re-renders.
- Page transitions are enter-only fades (`framer-motion`), reduced-motion aware via `MotionProvider`.
- `React.StrictMode` is on; boot side-effects are guarded against double-invoke.

## Images & fonts

- Fonts self-hosted via `@fontsource*` (imported from `global.css`) — no external font CDN, no FOUT
  from third-party origins.
- Media served from `VITE_CDN_URL`; responses return storage keys resolved by `lib/media.ts`. Content
  images use `object-cover` + `max-w-full`; decorative images use `alt=""`.
- Theme is applied pre-paint by an inline script in `index.html` (no flash-of-wrong-theme).

## Budget & monitoring

- Keep new heavy deps out of the initial bundle — lazy-import or split them.
- Watch the main `index` chunk (currently ~456 kB raw / ~143 kB gzip). If it grows, split the offender.
- Sentry captures runtime errors and (optionally) performance traces in production.
