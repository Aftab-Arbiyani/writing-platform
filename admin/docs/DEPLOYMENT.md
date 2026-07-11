# Qalam Admin — Deployment Guide

The admin app is a **static SPA** — `pnpm --filter admin build` emits a hashed,
cache-friendly `dist/` served by any static host / CDN / nginx behind TLS. It is
deployed separately from the reader app (its own subdomain, e.g. `admin.qalam.*`).

## Build

```bash
pnpm install --frozen-lockfile
pnpm --filter admin build          # tsc -b + vite build → admin/dist
```

The build is deterministic and hashed. It produces:

- Per-route chunks (`dashboard`, `users`, `reports`, `settings`, `analytics`,
  `audit-logs`, …) — code-split, loaded on demand.
- Long-cached vendor chunks (`vendor-react`, `vendor-antd`, `vendor-query`,
  `vendor-motion`) via `manualChunks`.
- ECharts split into its own on-demand chunks (loaded only when a chart mounts).
- Source maps (for Sentry release upload — not served publicly).

## Configuration at deploy time

Set the `VITE_*` vars **at build time** (Vite inlines them). For prod:

```
VITE_API_URL=/api/v1            # same-origin reverse-proxied to the API
VITE_APP_ENV=production
VITE_SENTRY_DSN=<dsn>
VITE_CDN_URL=<cdn base>
```

## Hosting (nginx sketch)

- Serve `dist/` as static files; **SPA fallback** all unknown paths to
  `index.html` (client routing owns them).
- Reverse-proxy `/api` → the backend so the app is same-origin (the refresh
  cookie + CORS stay simple). CORS `ADMIN_URL` on the backend must list the admin
  origin.
- Long-cache hashed assets (`Cache-Control: public, max-age=31536000, immutable`);
  never cache `index.html`.
- TLS only; set security headers (`Strict-Transport-Security`,
  `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin`, and a CSP
  compatible with the Sentry DSN + the API origin).

## CI gate (must pass before deploy)

```bash
pnpm --filter admin typecheck     # 0 errors
pnpm --filter admin lint          # 0 errors
pnpm --filter admin test          # all green
pnpm --filter admin build         # succeeds, no warnings
```

## Rollout

- Static, so rollout = publish `dist/` + invalidate the `index.html` cache.
- Rollback = republish the previous `dist/` (immutable hashed assets make this
  atomic).
- The backend `v1` contract is frozen, so the admin app and API deploy
  independently; the admin only needs additive `v1` fields.
- Upload source maps to Sentry tagged with the release for readable stack traces.
