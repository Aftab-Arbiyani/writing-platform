# Deployment Guide (Frontend)

The frontend is a **static SPA** — `pnpm build` emits `dist/` (hashed assets + `index.html`), served
by any static host / CDN with SPA fallback. Repo-wide deployment strategy lives in
`docs/15_DeploymentStrategy` and `docs/19_DeploymentGuide`; this covers the frontend specifics.

## Build

```bash
pnpm --filter frontend build     # tsc -b && vite build → dist/
pnpm --filter frontend preview   # smoke-test the built output locally
```

Sourcemaps are emitted (`build.sourcemap: true`) for Sentry release upload. Vendor chunks
(`vendor-react`, `vendor-antd`, `vendor-query`, `vendor-motion`) are split for long-term caching;
route modules and ECharts (`chart-core`) are lazy chunks.

## Host configuration

1. **SPA fallback** — rewrite all unknown paths to `/index.html` (client-side routing). Do NOT rewrite
   real files (`/manifest.webmanifest`, `/robots.txt`, `/sitemap.xml`, `/offline.html`, icons).
2. **Caching** — hashed `assets/*` immutable (`Cache-Control: max-age=31536000, immutable`);
   `index.html` no-cache so new deploys are picked up.
3. **Security headers** (recommended): `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`,
   `Referrer-Policy: strict-origin-when-cross-origin`, and a CSP allowing the API/CDN origins,
   `img-src` for media, and Sentry if enabled. `frame-ancestors 'none'`.
4. **Compression** — serve Brotli/gzip for JS/CSS.

## Environment (build-time)

Set the `VITE_*` vars (see [Environment Setup](./04_EnvironmentSetup.md)) in the build environment —
they are inlined at build time, not runtime. For production set at minimum:

```
VITE_API_URL=https://api.qalam.app/api/v1
VITE_APP_ENV=production
VITE_SITE_URL=https://qalam.app
VITE_CDN_URL=https://cdn.qalam.app
VITE_SENTRY_DSN=<dsn>
```

## SEO / PWA assets (deploy checklist)

- `public/robots.txt` — update the `Sitemap:` line to the deployed origin.
- Generate the sitemap for the deploy origin: `SITE_URL=https://qalam.app pnpm --filter frontend sitemap`
  (writes `public/sitemap.xml`; run before `build`, or as a build step). Append dynamic profile/piece
  URLs from a backend enumeration endpoint when available.
- `manifest.webmanifest`, `icon.svg`, `maskable-icon.svg`, `apple-touch-icon.svg`, `og-image.svg` ship
  from `public/`. **Recommended for production:** rasterise PNG icons (192/512, maskable) and a
  1200×630 PNG `og-image` — some app stores / iOS / social scrapers prefer PNG over SVG. No rasteriser
  was available in this workspace, so SVGs are shipped as the modern-browser baseline.
- Service worker (`public/sw.js`) is **not registered** unless `VITE_ENABLE_SW=true`. Keep it off until
  a real PWA/offline epic lands.

## CI gate (must pass before deploy)

```bash
pnpm --filter frontend typecheck
pnpm --filter frontend lint
pnpm --filter frontend test
pnpm --filter frontend build
```

All four are green as of F10. Upload sourcemaps to Sentry tagged with the release SHA after build.
