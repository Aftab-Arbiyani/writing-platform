# Qalam Admin — Environment Setup

## Prerequisites

- **Node 24**, **pnpm 9** (workspace-managed; run from the monorepo root)
- The backend API reachable at `VITE_API_URL` (default assumes local NestJS on
  `:4000`). Infra (postgres/redis/minio/mailpit) via `docker compose up -d`.

## Environment variables

Validated at boot by Zod (`src/config/env.ts`) — a bad/missing value fails fast
with a clear message. All are `VITE_`-prefixed (exposed to the client).

| Variable          | Required | Default                        | Purpose                                                                 |
| ----------------- | -------- | ------------------------------ | ----------------------------------------------------------------------- |
| `VITE_API_URL`    | no       | `http://localhost:4000/api/v1` | Backend `v1` base. Set to `/api/v1` behind a same-origin proxy in prod. |
| `VITE_CDN_URL`    | no       | `''`                           | Media/CDN base for asset URLs.                                          |
| `VITE_SENTRY_DSN` | no       | `''`                           | Sentry DSN; empty disables Sentry.                                      |
| `VITE_APP_ENV`    | no       | `development`                  | `development \| staging \| production` — tags Sentry + the env badge.   |

**No secrets** live in the client env — only public config. `.env` is git-ignored;
copy `.env.example` (if present) or export the vars.

## Local development

```bash
# from the monorepo root
pnpm install                 # workspace install
docker compose up -d         # postgres/redis/minio/mailpit
pnpm --filter backend dev    # API on :4000  (or `pnpm dev` for all apps)
pnpm --filter admin dev      # admin on :5174

# the dev server proxies /api -> http://localhost:4000 (see vite.config.ts),
# so VITE_API_URL can be left at its default or set to a relative /api/v1.
```

Admin runs on **5174** (the reader app owns 5173). Ports are `strictPort`.

## Scripts (`admin/package.json`)

| Script      | What it does                        |
| ----------- | ----------------------------------- |
| `dev`       | Vite dev server (:5174)             |
| `build`     | `tsc -b` + `vite build` → `dist/`   |
| `preview`   | Serve the production build locally  |
| `typecheck` | `tsc --noEmit -p tsconfig.app.json` |
| `lint`      | `eslint .`                          |
| `test`      | `vitest run`                        |

## Auth for local use

Sign in at `/login` with a seeded admin/super-admin account (see the backend
seeds). The access token is held in memory; the refresh cookie keeps the session
alive across reloads via the silent `bootstrapSession()` on load.
