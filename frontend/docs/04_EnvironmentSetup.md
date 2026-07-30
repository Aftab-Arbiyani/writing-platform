# Environment Setup Guide

## Prerequisites

- **Node 24**, **pnpm 9** (workspace manager).
- Backend API reachable (default `http://localhost:4000/api/v1`). For infra: `docker compose up -d`
  from the repo root (postgres, redis, minio, mailpit). Local host daemons may hold default ports —
  this repo runs Postgres on 5434 / Redis on 6380 (see repo memory / `docker-compose`).

## Install & run

```bash
pnpm install                 # workspace install from the repo root
pnpm --filter frontend dev   # Vite dev server on http://localhost:5173
# or, from frontend/:
pnpm dev
```

The dev server proxies `/api` → `http://localhost:4000` (see `vite.config.ts`), so same-origin API
calls work without CORS in development.

## Environment variables

Copy `frontend/.env.example` → `frontend/.env`. All values are **validated at boot** by
`src/config/env.ts` (Zod) — a misconfigured build fails fast with a readable error. Never read
`import.meta.env` directly; import `env`.

| Var               | Required | Default                              | Purpose                                                             |
| ----------------- | -------- | ------------------------------------ | ------------------------------------------------------------------- |
| `VITE_API_URL`    | ✅       | `http://localhost:4000/api/v1`       | Backend `v1` base URL                                               |
| `VITE_APP_ENV`    | —        | `development`                        | `development \| staging \| production`                              |
| `VITE_SITE_URL`   | —        | _(empty → `window.location.origin`)_ | Public origin for absolute canonical/OG URLs (SEO)                  |
| `VITE_CDN_URL`    | —        | _(empty → API origin)_               | Base for media assets (S3/CDN); responses return storage keys       |
| `VITE_ENABLE_SW`  | —        | `false`                              | `true` registers the `/sw.js` PWA placeholder (no offline sync yet) |
| `VITE_SENTRY_DSN` | —        | _(empty → disabled)_                 | Sentry error reporting                                              |

> `.env` is git-ignored and guarded — document new vars in `.env.example`, never commit secrets.

## Scripts (`frontend/`)

```bash
pnpm dev          # Vite dev server
pnpm build        # tsc -b && vite build → dist/
pnpm preview      # serve the production build locally
pnpm typecheck    # tsc --noEmit (strict)
pnpm lint         # eslint .
pnpm test         # vitest run
pnpm sitemap      # SITE_URL=https://… node scripts/generate-sitemap.mjs → public/sitemap.xml
```

## Editor / conventions

- Files kebab-case; components PascalCase; constants SCREAMING_SNAKE; booleans `is/has/can`.
- Strict TypeScript — no `any` (use `unknown` + narrowing); no non-null assertions outside tests.
- Prettier + ESLint via `@qalam/config` presets. Run `pnpm lint` before pushing.
