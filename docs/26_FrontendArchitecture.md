# 26 — Frontend Architecture

> **Status:** Binding implementation guide for the `frontend/` app (reader/writer web).
> **Derives from:** `00_ArchitectureDecisions.md` §6 (frontend stack), §7 (tokens), §10
> (route map + product decisions); `03_FolderStructure.md` §3 (feature-first layout);
> `05_APIStandards.md` (the frozen `v1` contract this app consumes).
> **This document is the entry point** for anyone building the frontend. It ties the
> existing design volumes together and maps every screen and component onto the **real,
> frozen** backend API. The applied build guidance for each topic now lives **inside its
> canonical doc**: routing → `11` (§10 route→API map), state → `12`, components → `08` (§8),
> design system → `07` (§12 applied usage), accessibility → `07` §13, coding standards →
> `16` §4, responsive → `06` §11, animation → `07` §14. The only other **standalone** build
> guides are `32` (API integration) and `33` (form validation). Where a topic already has a
> canonical home (`06`–`12`/`16`), this file points there and never restates values.

> **Scope note — Phase boundary.** The backend API is **frozen at `v1`** (`docs/25`). This
> app consumes `v1` exactly as implemented; it never assumes an endpoint the backend does
> not expose. Where a screen needs data the current surface does not provide, this document
> flags it as an **integration gap** (see §11) rather than inventing an endpoint. AI and
> payments are Phase 2 — no frontend surface for them ships now.

---

## 1. Architectural principles

The frontend is a **single-page React 19 application built with Vite 7**, served as a
static bundle behind nginx (`app.qalam.*`). It is a _client_ of the API — it owns
presentation, navigation, and optimistic UX; the server owns truth.

| #   | Principle                                                                                       | Consequence in code                                                                                          |
| --- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| 1   | **One cache, one truth.** Server data lives only in TanStack Query.                             | No server entity is ever copied into Zustand or `useState` (`12` §1, the golden rule).                       |
| 2   | **The URL is the view.** Tabs, filters, search, ranges live in the URL.                         | `?tab=`, `?q=`, `?range=` drive query keys directly; no effect-based URL⇄state sync (`11` §5).               |
| 3   | **Feature-first, deletable.** Each capability is one folder.                                    | `rm -rf src/features/<name>` + its route removal is the complete deletion test (`03` §3, §6.2).              |
| 4   | **One HTTP choke point.** All network I/O goes through `lib/api-client.ts`.                     | No `fetch`/`axios` in components or hooks (hard rule #5; enforced by lint).                                  |
| 5   | **Tokens only, RTL + dark day one.**                                                            | No raw hex/px; logical CSS properties only; every surface works in light+dark and ltr+rtl (`07`, `16` §4.6). |
| 6   | **Writing is the hero.** The reading/editor surfaces get the most refined type; chrome recedes. | Reading + editor routes render without standard app chrome (`06` §1, §3.2–3.3).                              |

**What this app is not:** it is not SSR (pure SPA — `main.tsx` mounts into `#root`), not
offline-capable (ADR §10), and not the admin console (that is a separate app, `admin/`,
with its own bundle and threat model — `03` §3.3).

---

## 2. The technology stack (as implemented)

Versions are pinned by the workspace; see `frontend/package.json` and ADR §6 "Version pins".

| Concern          | Library                                             | Notes / where configured                                                     |
| ---------------- | --------------------------------------------------- | ---------------------------------------------------------------------------- |
| Framework        | **React 19**                                        | `StrictMode`, function components only (`16` §4.2).                          |
| Build/dev        | **Vite 7** + `@vitejs/plugin-react`                 | `vite.config.ts`; `@/` alias → `src/`.                                       |
| Language         | **TypeScript 5.6, `strict`**                        | Extends `@qalam/config/tsconfig/react`; no `any`, no non-null `!` (`16` §1). |
| Server state     | **TanStack Query v5**                               | `lib/query-client.ts`; devtools in DEV only (`providers.tsx`).               |
| Client state     | **Zustand v5**                                      | Slice-per-concern; only theme is persisted (`12` §3).                        |
| URL/routing      | **React Router v7** (`react-router`)                | `app/router.tsx`; data-API `lazy()` route groups (`11`).                     |
| Forms            | **React Hook Form 7 + Zod 3.24**                    | `@hookform/resolvers`; schemas share `@qalam/shared` atoms (`33`).           |
| HTTP             | **native `fetch` wrapper**                          | `lib/api-client.ts`. **Not axios** — see §7 and `32` §1.                     |
| UI kit           | **Ant Design 5**                                    | Wrapped, never imported in app code (`08` §2); themed via `ConfigProvider`.  |
| Styling          | **Tailwind CSS v4** + `@qalam/ui` tokens            | `@tailwindcss/vite`; preflight off; logical props only (`07` §11).           |
| Motion           | **Framer Motion 12**                                | Variants from `@qalam/ui/motion` (`07` §5, §14).                             |
| Editor           | **TipTap 3** (`@tiptap/react`, `pm`, `starter-kit`) | Owns document state; loaded only inside the editor route (`12` §5).          |
| Icons            | **lucide-react**                                    | 1.5px stroke; `@ant-design/icons` banned in app code (`07` §6).              |
| Fonts            | **@fontsource** (Inter, Lora; Noto scripts)         | Self-hosted, no CDN (ADR §6; `07` §3.3).                                     |
| Errors/telemetry | **@sentry/react 9**                                 | Release-tagged; `VITE_SENTRY_DSN` gates it (`config/env.ts`).                |
| Types            | **@qalam/api-types**                                | OpenAPI-generated wire contract; the design contract for props (`08` §5).    |

**On Framer Motion + TipTap + Sentry** — all three are present in the scaffold's
dependencies and are load-bearing. **On React Helmet Async** (named in the brief): the
router already owns document titles via per-route title handles applied by a single effect
in the root layout (`11` §7); Phase 1 is a pure SPA with no SSR head to manage, so a
Helmet-style provider is **optional** and, if adopted, is confined to per-route `<title>`/
meta only. Do not add it for state it does not need.

---

## 3. Application bootstrap (the real boot path)

The entry sequence is already scaffolded. New work extends it; it does not replace it.

```
index.html
  └─ inline <head> script: reads localStorage["qalam-theme"], sets data-theme
     on <html> BEFORE the bundle loads  → zero theme flash (07 §3, 12 §3)
        │
main.tsx  (src/main.tsx)
  └─ createRoot(#root).render(
        <StrictMode>
          <AppProviders>          ← src/app/providers.tsx
            <AppRouter />          ← src/app/router.tsx
          </AppProviders>
        </StrictMode>)
        │
config/env.ts   ← Zod-validated import.meta.env; THROWS at module load on a bad
                  VITE_API_URL etc. A misconfigured build dies at boot, not on
                  the first request. Import `env`, never `import.meta.env` directly.
```

### 3.1 Provider composition (`app/providers.tsx`)

Order is fixed and meaningful:

```
QueryClientProvider (server state, single queryClient from lib/query-client.ts)
  └─ AntD ConfigProvider  theme={getAntdTheme(resolved)}  direction="ltr"
       └─ {children}
  └─ ReactQueryDevtools   (import.meta.env.DEV only — never ships)
```

- The **Zustand theme store owns `data-theme` on `<html>`** (Tailwind side); `providers.tsx`
  subscribes to `resolved` and feeds the same mode into `getAntdTheme(resolved)` — **one
  token source, two consumers, zero drift** (ADR §6). Never set AntD colors any other way.
- `direction="ltr"` is intentional: **UI chrome is LTR in Phase 1**; content-level RTL (Urdu
  pieces) is a per-node `dir` concern in the reader/editor, independent of chrome direction
  (`06` §6). When `react-i18next` lands, a locale store drives this prop — do not hardcode
  direction anywhere else.
- **Providers to add in Phase 1** (in this order, inside `ConfigProvider`): AntD `App`
  wrapper (for token-driven `message`/`notification`/`Modal` context — powers `useToast()`,
  `07` §7.9), `MotionProvider` (reduced-motion policy, `07` §5), Sentry `ErrorBoundary` at
  the root, and the router's own `RouterProvider` (already via `AppRouter`). Auth has **no
  provider** — session is a query (`qk.auth.me`), not context (§6, `12` §7).

### 3.2 Env contract

`config/env.ts` validates exactly three variables (ADR §10): `VITE_API_URL` (URL,
required), `VITE_APP_ENV` (`development|staging|production`, default `development`),
`VITE_SENTRY_DSN` (URL, optional; empty string = disabled). Adding an env var means editing
this schema **and** `frontend/.env.example` in the same PR. No other file reads
`import.meta.env` except Vite's built-in `import.meta.env.DEV`.

---

## 4. Folder structure (feature-first)

Canonical map is `03` §3.1; this is the Phase-1 target for `frontend/src/`, annotated with
what each feature owns. The scaffold currently holds `app/`, `lib/`, `stores/`,
`components/`, `features/`, `hooks/`, `types/`, `config/`, `styles/`, `test/`.

```
frontend/src/
├── app/                      # the ONLY place that knows about everything
│   ├── providers.tsx         # provider composition (§3.1)
│   ├── router.tsx            # route tree; lazy() route groups (11, 29)
│   ├── layouts/              # RootLayout, AuthLayout, SettingsLayout, EditorLayout (11 §3)
│   ├── guards/               # RequireAuth, RequireGuest (pathless layout routes, 11 §4)
│   └── pages/                # cross-cutting pages: not-found, error, unauthorized
│
├── features/                 # ★ one folder per capability; deletable in one rm -rf
│   ├── auth/                 # login, register wizard, forgot/reset, google callback
│   ├── feed/                 # /feed tabs; maps ?tab= → /feed/{following,latest,trending,discover}
│   ├── reading/              # /p/:slug reader: typography per script, footnotes, progress
│   ├── editor/               # TipTap surface, autosave, publish sheet (largest chunk)
│   ├── profile/              # /@:username, follows, follow-requests
│   ├── search/               # /search + /search/* group endpoints, recent, autocomplete
│   ├── discover/             # Discover tab data: /discover/{writers,pieces,tags,genres,languages}
│   ├── engagement/           # like, clap, bookmark, comment, response, share, collections UI
│   ├── collections/          # /me/collections, collection detail
│   ├── notifications/        # tray + unread badge + /notifications page + preferences
│   ├── analytics/            # /me/stats writer + reader dashboards
│   └── settings/             # /settings/{profile,account,appearance}
│   #
│   # each feature: features/<name>/{api,components,hooks,stores,schemas,types}
│   #   api/       TanStack Query hooks — the ONLY place this feature's endpoints are called
│   #   components/ feature-private components
│   #   hooks/     feature-private hooks
│   #   stores/    feature-private Zustand slices (client state only)
│   #   schemas/   Zod schemas for this feature's forms (33)
│
├── components/               # app-wide COMPOSITES that wire shell/session (TopBar,
│                             #   AppShell, NotificationsBell) — see 08 §1.1
├── lib/
│   ├── api-client.ts         # the single fetch wrapper (32)
│   ├── query-client.ts       # the single QueryClient
│   ├── query-keys.ts         # the qk.* key factory (12 §2.1)
│   ├── forms/                # applyServerErrors, resolver helpers (33)
│   └── error-messages.ts     # error.code → localized copy catalogue (06 §4.5)
├── stores/                   # truly app-wide Zustand slices (theme, session-ui) (12 §3)
├── hooks/                    # app-wide hooks (useMediaQuery, useDebouncedValue)
├── styles/                   # global.css (imports @qalam/ui tokens + tailwind)
├── config/                   # env.ts (typed env)
├── types/                    # app-wide ambient/shared TS types
└── test/                     # setup.ts + src/test/factories/ (16 §7.4)
```

Boundary rules are lint-enforced (`03` §5): **features never import other features**;
shared code moves _down_ to `components/`, `lib/`, or a `@qalam/*` package; `app/` composes
features, features never import `app/`.

### 4.1 Shared workspace modules (what the app imports, never the reverse)

| Package            | The app uses it for                                                                                                                                                                                                                       | Rule                                                                                                    |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `@qalam/shared`    | `ERROR_CODES`, enums (`PieceStatus`, `Visibility`, `Role`, `NotificationType`…), limits (`MAX_CLAPS_PER_USER=50`, `TAGS_MAX_PER_PIECE=5`…), regexes (`USERNAME_REGEX`), `PERMISSIONS`, `DEFAULT_ROLE_PERMISSIONS`, `permissionSatisfies`. | Branch on codes/enums from here, never string literals. Client permission checks derive from here (§8). |
| `@qalam/api-types` | Request/response wire types generated from `openapi.json`; the shape of every hook's result and every product component's props (`08` §5).                                                                                                | Never hand-duplicate a wire type; regenerate on backend change.                                         |
| `@qalam/ui`        | Tokens (`tokens.css`, tailwind `@theme`), `getAntdTheme()`, motion variants, primitives (`QButton`…) and product components (`PieceCard`…).                                                                                               | App never imports `antd` directly (`08` §2).                                                            |
| `@qalam/utils`     | Pure helpers: `slugify`, `readingTime`, cursor helpers, `assertNever`.                                                                                                                                                                    | No I/O, no domain constants.                                                                            |
| `@qalam/config`    | tsconfig/eslint/prettier presets.                                                                                                                                                                                                         | Build-time only; never imported at runtime.                                                             |

---

## 5. Routing overview

Full tree, guards, `@:username` handling, scroll restoration, code-splitting policy, **and
the route→API endpoint mapping (+ id/slug gaps and feed tab→path)** are all in
`11_RoutingArchitecture.md` (§10 for the endpoint map). Summary only here:

- **Unit of code-splitting = route group** via React Router `lazy()` (fetch-during-navigate,
  no render-then-suspend waterfall). `React.lazy` is reserved for below-route heavy islands:
  the **TipTap editor bundle**, the **publish sheet**, the **analytics chart pack** (`11` §9).
- **Layout routes** provide chrome: `RootLayout` (header + mobile tab bar + scroll
  restoration + toast outlet), `AuthLayout` (centered card, no chrome), `SettingsLayout`
  (side-nav), and the **editor route renders without RootLayout chrome** (`11` §3).
- **Guards are pathless layout routes**: `RequireAuth`, `RequireGuest`. They read the session
  from `qk.auth.me` and render the group skeleton while the boot refresh is in flight — never
  a redirect flash (`11` §4).

---

## 6. Authentication & session flow

The full state model is `12` §7; the interceptor implementation is `32` §3. The shape:

```
Boot: api-client has no access token in memory
  └─ POST /api/v1/auth/refresh   (httpOnly refresh cookie rides along, credentials:'include')
       ├─ 200 → access token into module-scoped memory → qk.auth.me resolves via GET /me
       │         → guards render the authed app
       └─ 401 → visitor mode, no error UI (an expired cookie is a normal Tuesday)
```

- **Access token: JS memory only** (a module variable in `lib/api-client.ts`) — never
  `localStorage`, never a readable cookie (XSS exfiltration). **Refresh token: httpOnly
  `Secure` `SameSite=Lax` cookie**, path-scoped to `/api/v1/auth`, invisible to JS (ADR §3,
  `05` §7). The current scaffold already sends `credentials: 'include'` on every request.
- **"Who am I" is a query** (`qk.auth.me` → `GET /api/v1/me`), not a store or context.
- **401 → single-flight refresh → retry once**, then hard-logout to
  `/auth/login?returnTo=…`. Concurrent 401s await one refresh promise (rotation would
  otherwise race and trip reuse detection). Implementation contract: `32` §3.
- **Google OAuth is a redirect dance** (mapped in `11` §10.2): `GET /auth/google` → Google →
  `GET /auth/google/callback` (302 to `${APP_URL}/auth/callback?code=…`) → the SPA's
  callback route calls `POST /auth/google/exchange` `{ code }` → access token in body,
  refresh cookie set. These two callback endpoints are the only non-enveloped responses.
- **Logout:** `POST /auth/logout` → null the in-memory token → `queryClient.clear()` →
  reset non-theme Zustand stores. Theme survives (device preference, `12` §7).

### 6.1 Email verification is a state, not a wall

`GET /me` and auth responses expose `isEmailVerified`. Certain actions require a verified
email server-side (`AUTH_EMAIL_UNVERIFIED` 403). The client shows a dismissible banner with
a **Resend** action (`POST /auth/resend-verification`) and lets unverified users read/browse;
it gates only the actions the server gates. Never block the whole app on verification.

---

## 7. API layer — the one choke point

Everything is in `32_APIIntegration.md`; the architectural facts:

- **`lib/api-client.ts` is the only place `fetch` is called** (scaffolded, real). It sets
  `Accept`/`Content-Type`, `credentials:'include'`, unwraps the success envelope to return
  `data`, and throws a typed **`ApiError`** (`code`, `status`, `details`, `requestId`) on any
  failure. Exports `get/post/patch/del`.
- **Per-feature `api/` hooks build on it**; components call hooks, hooks call `api/`, `api/`
  calls the client — three mockable layers (`16` §4.2). No exceptions.
- **Why fetch and not axios** (brief lists axios; we do not use it): ADR §6 fixed a
  "centralized typed `fetch` wrapper", hard-rule #5 mandates `lib/api-client.ts`, the wrapper
  already exists and is tested-shaped, and `axios` is not a workspace dependency. Adding it
  would be a real architecture change against a frozen decision, for zero capability gain
  (`fetch` + our envelope handling covers interceptors, cancellation via `AbortController`,
  and uploads). **Decision: keep fetch; the "Axios" line in the brief is superseded by the
  ADR** (`32` §1 documents this and the axios-equivalent recipes).

---

## 8. Authorization on the client (UX hints only)

**Critical contract, discovered in the API surface:** there is **no `/me/permissions`
endpoint** and **no role/permissions field in any response body**. The user's `role` is
carried **only in the JWT access-token claim** (`{ sub, role, sv, jti }`).

Therefore:

1. The app **decodes the JWT payload** (client-side, no verification — it is a hint, not a
   trust boundary) to read `role`, holding it beside the in-memory access token.
2. Effective capabilities are derived **client-side** from `@qalam/shared`
   `DEFAULT_ROLE_PERMISSIONS` + `permissionSatisfies(granted, required)` — the same catalogue
   the server resolves from. A `useCan('piece.publish')`-style hook gates UI affordances.
3. **These checks are UX only.** Per-user direct grants can exist server-side and are
   invisible to a JWT-only client, so client checks can _under-approximate_. The server is
   always authoritative (`AUTH_PERMISSION_DENIED` 403). Never rely on a client check for
   security; use it only to hide/disable affordances the user cannot use.

The reader app is almost entirely `user`-role; role-gated UI here is limited (e.g. a
moderator's inline "delete comment" affordance — comment delete is role-gated in the
service). The admin app is where role gating is load-bearing (`11` §8).

---

## 9. Screen inventory → route → API → feature

Every Phase-1 screen, its route (canonical map ADR §10 / `10` §1), the **real** endpoints it
consumes, and the owning feature. Sitemap/IA rationale is `10`; screen behavior is `06`.

| Screen                        | Route                                                                     | Primary API endpoints (as implemented)                                                                                                                                   | Feature         |
| ----------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------- |
| Landing                       | `/` (visitor) → `/feed` (user)                                            | none (static) / `GET /me` to decide redirect                                                                                                                             | `app`           |
| Home feed                     | `/feed?tab=following\|trending\|latest\|discover`                         | `GET /feed/following` (JWT), `/feed/latest`, `/feed/trending`, `/feed/discover`                                                                                          | `feed`          |
| Discover rails                | within `/feed?tab=discover`                                               | `GET /discover/{writers,pieces,tags,genres,languages}`                                                                                                                   | `discover`      |
| Piece reader                  | `/p/:slug`                                                                | `GET /pieces/:id` ⚠(by UUID — see §11), `GET /pieces/:id/engagement`, `GET /pieces/:id/comments`, `GET /pieces/:id/responses`; `POST /analytics/pieces/:id/view`,`/read` | `reading`       |
| Editor                        | `/write`, `/write/:draftId`                                               | `POST /pieces`, `PATCH /pieces/:id`, `POST /pieces/:id/preview`, `POST /pieces/:id/cover`                                                                                | `editor`        |
| Publish sheet                 | (within editor)                                                           | `POST /pieces/:id/publish` (Idempotency-Key), `/schedule`, `/archive`, `/unarchive`, `/duplicate`                                                                        | `editor`        |
| Writer profile                | `/@:username?tab=pieces\|collections\|about`                              | `GET /users/:username`, `GET /me/pieces` (own), `GET /collections`                                                                                                       | `profile`       |
| Follow requests               | (within profile / notifications)                                          | `GET /me/follow-requests`, `PATCH /follow-requests/:id/accept\|reject`, `POST\|DELETE /users/:id/follow`                                                                 | `profile`       |
| Followers/Following           | `/@:username` (tab/dialog)                                                | `GET /users/:username/followers`, `/following`                                                                                                                           | `profile`       |
| Search                        | `/search?q=&type=&language=&genre=&tag=`                                  | `GET /search`, `/search/{pieces,writers,tags,genres,languages}`, `/search/autocomplete`, `/search/trending`, `/search/recent`; `DELETE /search/recent[/:id]`             | `search`        |
| Tag hub                       | `/tag/:slug`                                                              | `GET /feed/latest?tag=…` (+`GET /search/tags?q=`)                                                                                                                        | `feed`          |
| Genre hub                     | `/genre/:slug`                                                            | `GET /feed/latest?genre=…`                                                                                                                                               | `feed`          |
| Drafts                        | `/me/drafts`                                                              | `GET /me/drafts` (cursor; status forced `draft`)                                                                                                                         | `editor`        |
| My pieces                     | (within profile/drafts)                                                   | `GET /me/pieces?status=`                                                                                                                                                 | `editor`        |
| Bookmarks                     | `/me/bookmarks`                                                           | `GET /me/bookmarks`; `POST\|DELETE /pieces/:id/bookmarks`                                                                                                                | `engagement`    |
| Collections                   | `/me/collections`, `/@:u/collections/:slug`                               | `GET/POST/PATCH/DELETE /collections[/:id]`, `GET/POST/DELETE /collections/:id/pieces`                                                                                    | `collections`   |
| Notifications                 | bell popover + `/notifications`                                           | `GET /notifications`, `/notifications/unread-count`, `PATCH /notifications/:id/read`,`/read-all`,`/:id/archive`, `DELETE /:id`; `GET/PATCH /notification-preferences`    | `notifications` |
| Writer analytics              | `/me/stats?range=`                                                        | `GET /analytics/me`, `/analytics/me/growth`, `/analytics/readers/me`, `/analytics/dashboard`, `GET /analytics/pieces/:id`                                                | `analytics`     |
| Settings · Profile            | `/settings/profile`                                                       | `GET/PATCH /me`, `POST /profile/avatar`,`/profile/cover`                                                                                                                 | `settings`      |
| Settings · Account            | `/settings/account`                                                       | `POST /auth/change-password`, `/auth/logout-all`; `GET /me` (email, google)                                                                                              | `settings`      |
| Settings · Appearance         | `/settings/appearance`                                                    | `GET/PATCH /settings` (theme, default visibility, notif prefs) + local theme store                                                                                       | `settings`      |
| Auth                          | `/auth/{login,register,forgot-password,reset-password}`, `/auth/callback` | `POST /auth/{register,login,refresh,forgot-password,reset-password,verify-email}`, `/auth/google/exchange`                                                               | `auth`          |
| Not Found / Error / Forbidden | `*`, error boundaries, 403 page                                           | none                                                                                                                                                                     | `app`           |

**Reading-completion tracking** (`06` §3.2, `10` §5.3): the reader fires
`POST /analytics/pieces/:id/view` on open (dedup by `sessionId`) and
`POST /analytics/pieces/:id/read` `{ durationSeconds, completionPct, sessionId }` when the
server thresholds are met (dwell ≥30s AND completion ≥50%). Both are `204`, optional-auth.

---

## 10. Component inventory → home

Every reusable component and where it lives (decision table `08` §1.1). Contracts/sketches
are in `08` §3; standards for _building_ them are in `08` §8. "Home" is one of: **UI** =
`@qalam/ui` (primitive `Q*` or product component), **components/** = app-wide composite,
**feature** = `features/<name>/components/`.

| Component                                                                                         | Home                       | Notes                                                                                                  |
| ------------------------------------------------------------------------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------ |
| QButton, QInput, QTextArea, QSelect, QSearch                                                      | UI (primitive)             | Wrap AntD; token-styled (`07` §7.1–7.2).                                                               |
| QCard, QDialog, QSheet, QTag, QBadge, LanguageBadge                                               | UI (primitive)             | Dialogs/sheets wrap AntD Modal/Drawer.                                                                 |
| QEmptyState, QSkeleton (+ PieceCardSkeleton…)                                                     | UI (primitive)             | Custom; literary voice + warm shimmer.                                                                 |
| useToast()                                                                                        | UI                         | Wraps AntD `notification` via `App` provider (`07` §7.9).                                              |
| PieceCard, QuoteCard, AuthorByline, ClapButton, ReadingProgress                                   | UI (product)               | Custom literary components (`08` §3.2).                                                                |
| Charts (line/bar/donut for analytics)                                                             | UI (product) or feature    | Token-mapped palette; single accent (`07` §2.3). Choose one chart lib; keep it in the analytics chunk. |
| AppShell, TopBar, MobileTabBar, Footer(landing)                                                   | components/                | Wire router + session; hold world-facing nav (`10` §3).                                                |
| NotificationsBell + panel                                                                         | components/                | Wires `qk.notifications.*`; badge = QBadge.                                                            |
| SearchBar (header)                                                                                | components/                | `/`-shortcut focus; suggestions → `/search`.                                                           |
| Avatar / UserMenu                                                                                 | components/                | Self-referential nav (`10` §3.1).                                                                      |
| Editor + EditorToolbar                                                                            | feature `editor`           | TipTap-bound; custom (`08` §2).                                                                        |
| PublishSheet, FootnotePopover, MentionPopover, HashtagPopover                                     | feature `editor`/`reading` | App-level, TipTap/selection-bound.                                                                     |
| RegisterWizard, UsernameConfirmDialog                                                             | feature `auth`             | The permanence moment (`06` §3.7).                                                                     |
| FollowButton, CommentThread, CommentComposer, ResponseComposer, ShareMenu, SaveToCollectionDialog | feature `engagement`       | Controlled; optimistic logic in hooks (`08` §5).                                                       |
| ProfileHeader, FollowRequestList                                                                  | feature `profile`          |                                                                                                        |
| StatTile, RangePicker, ByPieceTable                                                               | feature `analytics`        | Table wraps AntD in compact mode (`07` §7.5).                                                          |
| NotificationCard, PreferencesForm                                                                 | feature `notifications`    |                                                                                                        |
| SettingsForm(s), ThemePicker, ReadingSizePicker                                                   | feature `settings`         |                                                                                                        |

**Promotion is one-way** (`08` §1.1, §7): a feature component a second feature needs moves
_up_; never copy-pasted sideways.

---

## 11. Integration gaps (flagged, not invented)

The frozen `v1` surface does not cover a few things Phase-1 screens want. These are recorded
honestly for the build; each resolves via an **additive** backend endpoint (`docs/25` §8) or
a deferred epic — the frontend must not fake them.

1. **Read piece by slug.** The reader route is `/p/:slug`, but `GET /pieces/:id` accepts a
   **UUID** (`ParseUUIDPipe`), and there is no public `slug → piece` endpoint. Feed/search/
   profile lists return both `id` and `slug`, so navigating _from a list_ can carry the id;
   but a **cold load / shared link** to `/p/:slug` cannot resolve to an id today. This is
   consistent with **E5 Reading experience being deferred** (`CLAUDE.md`). Build the reader
   feature against `GET /pieces/:id`; treat slug-resolution as a required additive endpoint
   (e.g. `GET /pieces/by-slug/:slug`) and gate cold-load reader links behind it. Do **not**
   decode/guess ids from slugs.
2. **Taxonomy catalogues.** There are **no `GET /taxonomy/*` endpoints** (module has no
   controller). Genre/language pickers in the editor and filter dropdowns must source lists
   from `GET /discover/{genres,languages}` and `GET /search/{genres,languages}` (browse-by-
   usage when `q` is omitted). `12` §2.1's `qk.taxonomy.*` keys map to those endpoints, not a
   dedicated taxonomy route. Cache at the Taxonomy tier (1h, `12` §2.2).
3. **Some profile counters are placeholders.** `ProfileCountsDto` fields `totalReads`,
   `totalLikes`, `totalClaps`, `bookmarksReceived`, `responseCount` are hardcoded `0` pending
   later epics. Render `followers`, `following`, `piecesPublished` (real); hide or label the
   placeholders rather than showing misleading zeros.
4. **Reading lists / reposts / quotes** are in the IA and `12` invalidation map but are
   **not built** in `v1` (deferred E7 slice, ADR §E7 amendment). No endpoints exist. Do not
   ship `/me/lists` wiring or repost/quote actions until the backend adds them; the IA slot
   stays reserved (`10` §4).
5. **Admin moderation workflow** is out of this app entirely (separate `admin/` app; the
   full moderation UI is deferred, `CLAUDE.md`). Only monitoring/system-notifications/
   analytics admin APIs exist.

Each gap must be visible in the feature's `README`/`api/` layer as a `TODO(owner):` note
(`16` §6) — a silent workaround reads as "covered" when it is not.

---

## 12. Performance strategy

Budgets and techniques; measured against the "never make the writer wait" principle
(`06` §1). Detailed motion/skeleton rules in `07` §14; responsive in `06` §11.

| Lever              | Policy                                                                                                                                                                                                                                        |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Code splitting** | Route-group `lazy()`; editor/publish-sheet/charts are separate `React.lazy` chunks. Visitor-critical path = landing + `feed`+`piece` only; the editor (TipTap, the largest chunk) is never in it (`11` §9).                                   |
| **Prefetch**       | On idle from landing, prefetch the `feed`+`piece` chunk. On feed-card hover/focus (desktop) or viewport-enter (mobile), `queryClient.prefetchQuery` the piece detail.                                                                         |
| **Vendor chunks**  | Vite `manualChunks` splits `react`, `react-router`, TanStack Query, AntD core. Token CSS ships in the entry so first paint is on-theme in both modes (`11` §9).                                                                               |
| **Query cache**    | `staleTime` tiers (`12` §2.2): Live 30s (feed/notifications), Content 5min (piece), Identity 1min (me/profiles), Taxonomy 1h. `gcTime ≥ 15min` so Back renders from cache.                                                                    |
| **Infinite feeds** | `useInfiniteQuery` over the cursor contract; fetch next page when sentinel is 800px from viewport bottom (`06` §4.2). Restored pages re-render synchronously from cache for correct scroll restoration.                                       |
| **Skeleton-first** | Layout-matched skeletons within 100ms; spinners only inside buttons; skeleton dims match real min-heights (no reflow) (`06` §4.3).                                                                                                            |
| **Editor**         | Document state lives in TipTap/ProseMirror, **never React state per keystroke**; React reads `editor.getJSON()` at autosave/preview/publish only (`12` §5). Debounced autosave writes back via `setQueryData`, never invalidation storms.     |
| **Images**         | Covers/avatars are S3 **keys** (`coverImageKey`, `avatarKey`) — the client builds the CDN URL (`32` §6). Use `loading="lazy"`, explicit width/height (no layout shift), `max-width:100%`; dark mode dims covers `brightness(0.92)` (`06` §5). |
| **Fonts**          | @fontsource woff2, Latin subset preloaded; Devanagari/Naskh via `unicode-range`; **Nastaliq lazy-loaded** by the Urdu reading surface only (`07` §3.3).                                                                                       |
| **Reduced motion** | All animation degrades via the shared `MotionProvider` (`07` §14); no per-component motion literals.                                                                                                                                          |
| **Telemetry**      | Sentry release-tagged with sourcemaps; `X-Request-Id` propagated frontend→API→jobs for one-grep tracing (ADR §9).                                                                                                                             |

---

## 13. Definition of done (frontend feature)

A feature is done when (extends `16` §8):

```
□ Consumes only real v1 endpoints (this doc §9); integration gaps flagged, not faked
□ All HTTP via lib/api-client + feature api/ hooks; no fetch/axios elsewhere
□ Server state in TanStack Query only; qk.* keys in lib/query-keys.ts; invalidation row added (30)
□ URL owns tabs/filters; params read through validated hooks (Zod-coerced), not raw searchParams
□ Forms are RHF + Zod; server-error mapping wired (33)
□ Tokens only; logical CSS props only; verified in light+dark AND ltr+rtl
□ Route registered as a lazy() group; heavy islands are React.lazy
□ A11y: focus ring, keyboard operable, ARIA per 34; axe clean
□ rm -rf features/<name> + route removal is the complete deletion (03 §6.2)
□ Vitest specs for hooks/logic; no server state mocked below the api layer (MSW at the boundary)
```
