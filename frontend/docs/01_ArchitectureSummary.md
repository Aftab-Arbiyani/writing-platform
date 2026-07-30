# Frontend Architecture Summary

## Stack

React 19 · Vite 7 · TypeScript (strict) · AntD 5 + Tailwind 4 (design tokens) · TanStack Query
(server state) · Zustand (client/UI state) · React Router 7 (data router) · React Hook Form + Zod
(forms) · TipTap 3 (editor) · ECharts 6 (analytics) · react-helmet-async (SEO) · Sentry (telemetry).

## Directory map

```
src/
├── app/                 # composition root — NOT a feature
│   ├── providers.tsx    # ErrorBoundary → Helmet → Query → AntD(theme+dir) → App → Motion
│   ├── router.tsx       # route table; every route is lazy: () => import(...)
│   ├── routes/          # thin lazy route modules → delegate to feature barrels
│   ├── layouts/         # root-layout (app shell), auth-layout
│   ├── pages/           # cross-cutting pages: home-route, not-found, forbidden, offline, …
│   ├── guards/          # require-auth, require-guest
│   ├── error-boundary.tsx, sentry.ts
├── features/<name>/     # 8 features: auth, feed, writing, profile, search, notifications, settings, analytics
│   └── {api,components,hooks,stores,types,pages,lib,schemas}/   # deletable with one `rm -rf`
├── components/          # shared app chrome: top-bar, mobile-tab-bar, footer, skip-link, offline-banner, user-menu, seo
├── hooks/               # shared hooks: use-page-title, use-debounce, use-focus-trap, use-me, …
├── lib/                 # api-client, query-client, query-keys, routes, errors, media, format, seo, platform, …
├── stores/              # app-level Zustand: app.store (online/nav), auth.store, theme.store
├── pwa/                 # service-worker-registration (placeholder), use-install-prompt
├── config/env.ts        # typed + validated environment (Zod)
├── styles/global.css    # Tailwind entry + tokens + prose + print styles
└── test/                # renderWithProviders harness + setup polyfills
```

## Golden rules (enforced)

1. **Feature isolation** — a feature never imports another feature's internals. Shared code lives in
   `@/lib`, `@/components`, `@/hooks`, or a `@qalam/*` package. (Verified: zero cross-feature imports.)
2. **Server state → TanStack Query; never Zustand.** Zustand holds only client/UI state (theme,
   online status, nav, editor UI, analytics view-prefs). URL is the source of truth for tabs/filters.
3. **All HTTP through `lib/api-client.ts`** (a typed `fetch` wrapper — not axios). The only exception is
   `lib/upload.ts` (XHR, for upload progress). Every response is the envelope
   `{ success, data, meta } | { success:false, error:{ code, … } }`; error codes come from `@qalam/shared`.
4. **RTL day-one** — CSS **logical** properties only (`ms/me/ps/pe/start/end`); physical `ml/mr/pl/pr/left/right`
   are banned. (Verified: zero violations.)
5. **Tokens only** — colours via `--q-*` tokens (Tailwind theme + AntD algorithm from one resolved mode);
   dark mode works on every surface. No raw hex in components (except the Google brand SVG).

## Routing

`app/router.tsx` is a React Router 7 data router. Every route module is code-split
(`lazy: () => import('@/app/routes/*')`). Routes render inside `RootLayout` (app shell: skip-link →
top-bar → offline-banner → `<main id="main">` with page-transition → footer → mobile-tab-bar →
command-palette → scroll-restoration). `require-auth` / `require-guest` guards gate access; the boot
session-restore (`bootstrapSession`) resolves auth status once before guards decide.

## Data flow

Component → feature `hooks/` (TanStack Query) → feature `api/` (names endpoints, builds query strings,
threads `AbortSignal`) → `lib/api-client` (envelope unwrap, 401 handling, error mapping) → backend `v1`.
Query keys are centralised in `lib/query-keys.ts`; cache tiers/staleTimes follow `docs/12`.

## SEO & PWA (F10)

- `usePageTitle` owns `document.title`; `components/seo.tsx` (`<Seo>`) adds description, canonical, OG,
  Twitter, robots, and JSON-LD via Helmet on public pages. Utility/auth/private pages pass `noindex`.
- PWA scaffolding in `public/` (manifest, icons, robots.txt, offline.html, sitemap) + `src/pwa/`
  (SW registration placeholder — off by default; install-prompt hook). No offline sync (deferred).
