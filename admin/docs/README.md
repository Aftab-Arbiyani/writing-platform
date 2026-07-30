# Qalam Admin — Documentation Index

Production documentation for the Qalam **admin** operations console. Generated /
finalized in Epic A9 (production readiness).

## Documents

| Doc                                        | Covers                                                   |
| ------------------------------------------ | -------------------------------------------------------- |
| [ARCHITECTURE.md](./ARCHITECTURE.md)       | Stack, folder structure, provider stack, state model     |
| [ROUTES.md](./ROUTES.md)                   | Route inventory + role floors + guard composition        |
| [COMPONENTS.md](./COMPONENTS.md)           | Shared + feature component & hook inventory              |
| [API_INTEGRATION.md](./API_INTEGRATION.md) | api-client, query config, endpoint map, error→UX mapping |
| [SHARED_PACKAGES.md](./SHARED_PACKAGES.md) | `@qalam/*` usage + refactor review                       |
| [ENVIRONMENT.md](./ENVIRONMENT.md)         | Env vars (Zod-validated) + local setup                   |
| [DEPLOYMENT.md](./DEPLOYMENT.md)           | Build, hosting (nginx), CI gate, rollout                 |
| [PERFORMANCE.md](./PERFORMANCE.md)         | Splitting, ECharts lazy-loading, caching, audit result   |
| [ACCESSIBILITY.md](./ACCESSIBILITY.md)     | WCAG AA patterns + audit result + fixes                  |
| [TESTING.md](./TESTING.md)                 | Harness, coverage of critical flows, conventions         |

## Production readiness snapshot (A9)

| Gate                | Status                                                                                         |
| ------------------- | ---------------------------------------------------------------------------------------------- |
| TypeScript (strict) | ✅ `tsc --noEmit` — 0 errors                                                                   |
| ESLint              | ✅ `eslint .` — 0 errors                                                                       |
| Tests               | ✅ 52 files / 153 tests green                                                                  |
| Production build    | ✅ succeeds, **no warnings**                                                                   |
| Unused dependencies | ✅ none                                                                                        |
| Dead code           | ✅ removed (9 items) — verified zero references                                                |
| Duplication         | ✅ consolidated (`useDebouncedSearch`, `downloadExport`)                                       |
| Console statements  | ✅ none                                                                                        |
| Performance audit   | ✅ no P1 — route/section/ECharts split, cached, abort                                          |
| Accessibility audit | ✅ no P1 (skip link + minor fixes applied)                                                     |
| Security audit      | ✅ no P1 (token in-memory, guards floored, XSS-free); role-rank + Sentry-PII hardening applied |
| Responsive          | ✅ desktop/tablet/mobile — logical CSS, stacked charts, mobile nav drawer                      |

The admin application is **production-ready**.

## Quick reference

- Dev: `pnpm --filter admin dev` (`:5174`)
- Verify: `pnpm --filter admin typecheck && … lint && … test && … build`
- Deploy: static `dist/` behind TLS + SPA fallback + `/api` reverse-proxy.
