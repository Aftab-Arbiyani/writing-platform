# Qalam Admin — Architecture Summary

The Qalam **admin** application is the internal operations console for the Qalam
writing platform. It is a single-page React app that consumes the frozen `v1`
backend API. It shares design tokens, vocabulary, and utilities with the reader
app through workspace packages but is a wholly separate deployable.

## Stack

| Concern          | Choice                                                       |
| ---------------- | ------------------------------------------------------------ |
| Framework        | React 19 + TypeScript (strict)                               |
| Build/dev        | Vite 7 (`@vitejs/plugin-react`, `@tailwindcss/vite`)         |
| UI               | AntD 5 (complex widgets) + Tailwind 4 (layout) + `@qalam/ui` |
| Server state     | TanStack Query v5                                            |
| Client state     | Zustand v5 (+ `persist` for UI prefs)                        |
| Forms            | React Hook Form + Zod                                        |
| Routing          | React Router v7 (data router)                                |
| Charts           | Apache ECharts 6 (lazy, tree-shaken)                         |
| Errors/telemetry | `react-error-boundary` + Sentry (`@sentry/react`)            |
| Tests            | Vitest + Testing Library + jsdom                             |

## Folder structure (feature-first)

```
src/
├─ app/            router, guards, layouts, error boundary, providers, sentry
├─ components/     shared, cross-feature UI (40 components)
├─ hooks/          shared hooks (use-admin-table, use-permissions, …)
├─ lib/            api-client, query-client, query-keys, format, errors, routes, jwt
├─ config/         env (Zod-validated)
├─ stores/         Zustand: auth, theme, sidebar, admin-ui
├─ features/       one folder per domain (feature-first)
│  └─ <feature>/   api · hooks · components · pages · stores · schemas · types · index.ts
└─ test/           render helper (provider stack for tests)
```

Every **feature is deletable with one `rm -rf`** — it owns its api/hooks/
components/pages/stores/types and exposes a single `index.ts` barrel (the Page).
Cross-cutting concerns live in `src/{components,hooks,lib,stores}`.

**Features:** `auth`, `dashboard`, `users`, `moderation`, `audit`, `settings`,
`analytics`. (Content/taxonomy admin surfaces remain placeholder routes.)

## Provider stack (`src/app/providers.tsx`)

```
ErrorBoundary (RootErrorFallback + Sentry.onError)
└─ HelmetProvider                     document <title> per page
   └─ QueryClientProvider             the single server-state cache
      └─ AntD ConfigProvider          --q-* theme tokens, LTR/RTL
         └─ AntD App                  message / notification / modal context
            └─ MotionProvider         reduced-motion-aware page transitions
               └─ <app>
```

A `bootstrapSession()` runs on mount (silent refresh) so a returning admin lands
authenticated without a flash; the api-client's `setUnauthorizedHandler` wires a
terminal-401 → session-end → redirect.

## State model

- **Server state lives only in TanStack Query** — never mirrored into Zustand
  (one cache, one invalidation model). Query keys come from a single factory
  (`src/lib/query-keys.ts`, `qk.*`).
- **Client state is Zustand**, four small stores: `auth` (session + role),
  `theme` (persisted, `data-theme`), `sidebar` (collapse/mobile), `admin-ui`
  (transient chrome). Feature-local UI prefs use their own persisted stores
  (e.g. `analytics-filters`, `settings-ui`, table prefs).
- **URL is the source of truth** for tabs, filters, pagination, and sort on list
  surfaces (`useAdminTable`); selection is local.

## Request/response

All HTTP goes through the centralized **`api-client`** (`src/lib/api-client.ts`),
a typed `fetch` wrapper (ADR §6 freezes fetch — axios is not a dependency). It
unwraps the `{ success, data, meta }` envelope, throws a typed `ApiError` (branch
on `.code`), carries the in-memory access token, and performs single-flight
refresh on a recoverable 401. The only sanctioned raw `fetch` is the export/blob
streams (raw CSV/JSON, not the envelope), which still send the Bearer token.

## Layering & conventions

`page → feature hook → feature api → api-client`. Components never call `fetch`.
Files are kebab-case; hooks `use-*`; stores `*.store.ts`; one `index.ts` barrel
per feature. Strict TypeScript (no `any`), RTL-safe logical CSS, `--q-*` tokens
only, dark mode on every surface.
