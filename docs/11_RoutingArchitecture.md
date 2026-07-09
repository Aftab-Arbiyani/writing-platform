# 11 — Routing Architecture

> **Derives from:** `00_ArchitectureDecisions.md` §6 (React Router v7 data APIs; URL as
> source of truth), §8 (RBAC), §10 (route map — mirrored exactly). Sitemaps and URL policy:
> `10_InformationArchitecture.md`. Data-fetching split: routes **navigate**, TanStack Query
> **fetches** (`12_StateManagement.md`) — loaders are used for code/session readiness, not
> as a second data layer.

---

## 1. Frontend route tree (`frontend/src/app/router.tsx`)

Code-shaped sketch — illustrative, not an implementation:

```tsx
export const router = createBrowserRouter([
  {
    element: <RootLayout />, // header/mobile nav + <ScrollRestoration/> + Suspense shell
    errorElement: <RootErrorBoundary />,
    children: [
      { path: '/', lazy: () => import('./routes/landing') }, // Visitor; User → /feed

      // ── public reading surfaces ─────────────────────────────────────────
      { path: 'feed', lazy: () => import('./routes/feed') }, // ?tab=
      {
        path: 'p/:slug',
        lazy: () => import('./routes/piece'),
        errorElement: <PieceErrorBoundary />,
      },
      { path: 'search', lazy: () => import('./routes/search') }, // ?q=&type=&…
      { path: 'tag/:slug', lazy: () => import('./routes/tag-hub') },
      { path: 'genre/:slug', lazy: () => import('./routes/genre-hub') },

      // ── authed surfaces ─────────────────────────────────────────────────
      {
        element: <RequireAuth />, // guard layout — renders <Outlet/> or redirects
        children: [
          { path: 'write', lazy: () => import('./routes/editor') },
          { path: 'write/:draftId', lazy: () => import('./routes/editor') },
          {
            path: 'me',
            children: [
              { index: true, element: <Navigate to="drafts" replace /> },
              { path: 'drafts', lazy: () => import('./routes/me/drafts') },
              { path: 'stats', lazy: () => import('./routes/me/stats') }, // ?range=
              { path: 'bookmarks', lazy: () => import('./routes/me/bookmarks') },
              { path: 'lists', lazy: () => import('./routes/me/lists') },
              { path: 'collections', lazy: () => import('./routes/me/collections') },
            ],
          },
          {
            path: 'settings',
            element: <SettingsLayout />, // side-nav: Profile · Account · Appearance
            children: [
              { index: true, element: <Navigate to="profile" replace /> },
              { path: 'profile', lazy: () => import('./routes/settings/profile') },
              { path: 'account', lazy: () => import('./routes/settings/account') },
              { path: 'appearance', lazy: () => import('./routes/settings/appearance') },
            ],
          },
        ],
      },

      // ── guest-only auth surfaces ────────────────────────────────────────
      {
        element: <RequireGuest />,
        children: [
          {
            element: <AuthLayout />, // centered card, no app chrome
            children: [
              { path: 'auth/login', lazy: () => import('./routes/auth/login') },
              { path: 'auth/register', lazy: () => import('./routes/auth/register') },
              { path: 'auth/forgot-password', lazy: () => import('./routes/auth/forgot') },
              { path: 'auth/reset-password', lazy: () => import('./routes/auth/reset') }, // ?token=
              { path: 'auth/google/callback', lazy: () => import('./routes/auth/google-cb') },
            ],
          },
        ],
      },

      // ── profile — LAST: catches the @-handle pattern ────────────────────
      {
        path: ':handle', // matches "@meer_taqi"; see §1.1
        lazy: () => import('./routes/profile'),
        children: [{ path: 'collections/:slug', lazy: () => import('./routes/collection') }],
      },

      { path: '*', element: <NotFound /> },
    ],
  },
]);
```

### 1.1 The `/@:username` pattern

React Router cannot match a **partial** dynamic segment (`@:username` mixes a static prefix
and a param in one segment). Resolution: register `:handle` as the _final_ dynamic route —
so every static route above wins first — and validate inside the profile route module:

```tsx
// routes/profile.tsx (route module loaded by `lazy`)
export function loader({ params }: LoaderFunctionArgs) {
  const handle = params.handle ?? '';
  if (!handle.startsWith('@')) throw new Response(null, { status: 404 });
  return { username: handle.slice(1) }; // validated against USERNAME_REGEX downstream
}
```

_Why not `/u/:username`:_ `/@name` is the identity contract promised in the signup flow and
the IA (docs 09 §1, 10 §5) — the router bends, not the URL. Reserved words (`feed`,
`search`, `me`, `settings`, `auth`, `write`, `p`, `tag`, `genre`) can never collide with
handles because usernames matching them are rejected at registration (`@qalam/shared`
reserved-username list) _and_ static routes match first anyway. Defense in both layers.

---

## 2. Admin route tree (`admin/src/app/router.tsx`)

```tsx
export const adminRouter = createBrowserRouter([
  {
    element: <RequireGuest redirectTo="/dashboard" />,
    children: [{ path: 'login', lazy: () => import('./routes/login') }],
  },
  {
    element: <RequireRole min="moderator" />, // floor for the entire console — §8
    children: [
      {
        element: <AdminShell />, // AntD Layout: side-nav + env badge header
        errorElement: <AdminErrorBoundary />,
        children: [
          { index: true, element: <Navigate to="/dashboard" replace /> },
          { path: 'dashboard', lazy: () => import('./routes/dashboard') },
          { path: 'pieces', lazy: () => import('./routes/pieces') }, // ?page=&status=&language=
          { path: 'reports', lazy: () => import('./routes/reports') }, // ?page=&status=&reason=
          { path: 'prompts', lazy: () => import('./routes/prompts') },

          {
            element: <RequireRole min="admin" />,
            children: [
              { path: 'users', lazy: () => import('./routes/users') },
              { path: 'card-templates', lazy: () => import('./routes/card-templates') },
              { path: 'languages', lazy: () => import('./routes/languages') },
              { path: 'featured', lazy: () => import('./routes/featured') },
              { path: 'analytics', lazy: () => import('./routes/analytics') },
              { path: 'moderators', lazy: () => import('./routes/moderators') },
              { path: 'audit-logs', lazy: () => import('./routes/audit-logs') },
            ],
          },

          {
            element: <RequireRole min="super_admin" />,
            children: [{ path: 'roles', lazy: () => import('./routes/roles') }],
          },

          { path: '*', element: <AdminNotFound /> },
        ],
      },
    ],
  },
]);
```

---

## 3. Layout routes

| Layout           | App      | Provides                                                                                                     | Notes                                                 |
| ---------------- | -------- | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------- |
| `RootLayout`     | frontend | Header + mobile bottom nav (doc 10 §3), toast outlet, `<ScrollRestoration/>`, route-level `<Suspense>` shell | The only place app chrome is rendered                 |
| `AuthLayout`     | frontend | Centered card, wordmark, **no** header/nav                                                                   | Auth is a corridor, not a room — no exits to distract |
| `SettingsLayout` | frontend | Side-nav (Profile · Account · Appearance), page title slot                                                   | Nested under `RequireAuth`                            |
| Editor route     | frontend | Renders **without** RootLayout chrome (own minimal top bar: back, save status, Preview, Publish)             | Writing is the hero (ADR §7) — full-attention surface |
| `AdminShell`     | admin    | AntD side-nav grouped per doc 10 §3.4, env badge, admin user menu                                            | Desktop-only console                                  |

Guards (`RequireAuth`, `RequireGuest`, `RequireRole`) are **pathless layout routes** — they
compose with visual layouts instead of duplicating redirect logic per page.

---

## 4. Guards — behavior spec

All guards read the session from `qk.auth.me` (single source, `12_StateManagement.md` §7).
While the boot refresh is in flight they render the route-group skeleton — guards never
flash a redirect before the session answer arrives (_Why:_ a false bounce to login on every
hard reload is the classic in-memory-token bug).

| Guard              | Pass condition               | Fail behavior                                                                                                                                                    |
| ------------------ | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `RequireAuth`      | `me` resolved with a user    | `navigate("/auth/login?returnTo=" + encodeURIComponent(pathname + search), { replace: true })`                                                                   |
| `RequireGuest`     | no session                   | `navigate(returnTo ?? "/feed", { replace: true })` — logged-in users never see auth pages                                                                        |
| `RequireRole(min)` | `me.roles` ⊇ hierarchy floor | Lower authenticated role → 403 page (**not** redirect — hiding admin pages from a moderator is confusing, denying is honest). No session → login with `returnTo` |

**Redirect-with-return-to contract**

1. `returnTo` is captured as **path + query** (never origin) at the moment of denial.
2. After successful login/registration, `RequireGuest` (now failing on the auth page) sends
   the user to `returnTo`; consumed once, `replace: true` so Back never re-enters the corridor.
3. Only same-origin relative paths starting with `/` are honored — anything else falls back
   to `/feed` (open-redirect defense, ADR §8 spirit).
4. Mid-session logout from a guarded page → `RequireAuth` fires with the current location,
   so re-login round-trips back to where the user was.

---

## 5. URL state conventions

**The URL is the source of truth for anything that changes _which view_ the user sees**
(ADR §6). Component state may cache _how_ it's shown (hover, open dropdown) — never _what_.

| State                    | Carrier                                                | Example                                                                                                  |
| ------------------------ | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| Feed tab                 | `?tab=`                                                | `/feed?tab=trending` (default `following` for users, `discover` for visitors — default omitted from URL) |
| Search query + filters   | `?q=&type=&language=&genre=&tag=`                      | `/search?q=ghazal&type=pieces&language=ur`                                                               |
| Profile tab              | `?tab=`                                                | `/@meer?tab=collections`                                                                                 |
| Analytics range          | `?range=`                                              | `/me/stats?range=90d`                                                                                    |
| Admin table page/filters | `?page=&…` (offset pagination, ADR §5)                 | `/reports?page=3&status=pending`                                                                         |
| Reset/onboarding tokens  | `?token=`, `?provider=`                                | consumed on submit                                                                                       |
| Feed/infinite cursors    | **not in the URL** — TanStack infinite-query internals | opaque base64 cursors are meaningless to share; the tab is the shareable state                           |

Rules:

1. Defaults are omitted (`/feed`, not `/feed?tab=following`) — one canonical URL per view.
2. Tab/filter changes use `setSearchParams(..., { replace: false })` → Back walks tab
   history; typing in the search field debounces with `replace: true` → keystrokes don't
   spam history.
3. Reading a param is always validated against a Zod enum; garbage (`?tab=lol`) silently
   coerces to the default rather than erroring.

_Why URL-first:_ shareability (a trending-feed link means trending for the recipient),
refresh-safety, and it deletes an entire class of "sync state to URL" effects.

---

## 6. Error boundaries & NotFound

```
RootErrorBoundary (frontend)                 AdminErrorBoundary
└─ per-route-group boundaries:               └─ section boundary per nav item
   ├─ PieceErrorBoundary   (reader keeps chrome; retry CTA)
   ├─ EditorErrorBoundary  (draft-preserving: shows last-saved time + recovery copy)
   └─ route modules throwing Response(404) → NotFound rendering
```

- **Granularity = one boundary per route group.** A failed feed never takes down the header;
  a crashed editor pane must show "your draft was saved 12 s ago" (autosave makes this claim
  truthful — doc 09 Flow 5).
- **Thrown `Response` semantics:** loaders/queries throw `Response(404)` for missing or
  invisible resources — private pieces 404, never 403 (existence is not leaked, doc 09 Flow 7).
  `errorElement` inspects `isRouteErrorResponse` to render NotFound vs. crash UI.
- **NotFound strategy:** full chrome + search field + trending links — a dead end that
  offers exits. Piece 404s add "this piece may have been unpublished". The `*` splat and
  invalid `:handle` (§1.1) converge on the same component.
- Render errors report to Sentry with the route id as a tag (ADR §9); the boundary offers
  _Try again_ (`revalidate`/query refetch) before suggesting a reload.

---

## 7. Scroll restoration & document titles

**Scroll (one `<ScrollRestoration/>` in RootLayout, key = `location.key`):**

| Navigation                     | Behavior                                                                                                                                                                                                                                                                                                                                |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PUSH (link/tab click)          | Scroll to top — a new place starts at its beginning                                                                                                                                                                                                                                                                                     |
| POP (Back/Forward)             | Restore the exact prior offset — including infinite feeds (restored TanStack pages re-render synchronously from cache, so the offset lands correctly)                                                                                                                                                                                   |
| `?` param change via `replace` | No scroll reset — filter tweaks aren't navigation                                                                                                                                                                                                                                                                                       |
| **Reading position**           | Separate system, _not_ scroll restoration: per-piece max progress in `sessionStorage` keyed by piece id, feeding the completion tracker (doc 09 Flow 7) and a "resume reading" affordance. _Why separate:_ restoration is per-history-entry and dies with the session stack; reading position is per-document and must survive revisits |

**Document titles** — each route module exports a title handle; a single effect in
RootLayout applies it (SPA — no SSR head management needed):

| Surface       | Pattern                                                                                      |
| ------------- | -------------------------------------------------------------------------------------------- |
| Piece         | `{title} — {penName} · Qalam` (title in its own script — Nastaliq titles stay Nastaliq)      |
| Profile       | `{penName} (@{username}) · Qalam`                                                            |
| Sections      | `{Section} · Qalam` (`Feed`, `Search "ghazal"`, `Drafts`, `Settings`)                        |
| Editor        | `{draft title ∥ "Untitled"} — Draft · Qalam` (+ `•` unsaved-dot prefix mirroring save state) |
| Admin         | `{Section} · Qalam Admin` (+ `[staging]` env prefix outside prod)                            |
| Notifications | Unread count prefixes the title (`(3) Feed · Qalam`)                                         |

---

## 8. Admin routing ↔ RBAC map

Role hierarchy (ADR §8): `user < moderator < admin < super_admin` — `RequireRole(min)` is a
floor check, so every higher role passes automatically.

| Route                                                                                              | Minimum role  | Rationale                                                                    |
| -------------------------------------------------------------------------------------------------- | ------------- | ---------------------------------------------------------------------------- |
| `/dashboard`, `/pieces`, `/reports`, `/prompts`                                                    | `moderator`   | Daily moderation loop (doc 09 Flow 15) needs content + queue + prompts       |
| `/users`, `/languages`, `/featured`, `/card-templates`, `/analytics`, `/moderators`, `/audit-logs` | `admin`       | Account power (suspend), platform curation, and the audit trail              |
| `/roles`                                                                                           | `super_admin` | Role assignment is privilege escalation surface — smallest possible audience |
| `/login`                                                                                           | none (guest)  |                                                                              |

Enforcement layering — the router is the **first** gate, never the only one:

1. `RequireRole` gates rendering (and the side-nav renders only sections the role can enter — doc 10 §3.4).
2. Every admin API endpoint re-checks the role via NestJS guards (ADR §8) — a hand-crafted
   fetch against `api.qalam.*` hits the same wall.
3. Every admin **mutation** lands in `audit_logs` regardless of which gate let it through.

A `user`-role account authenticating against the admin app passes `RequireGuest` at
`/login` but fails the console floor → static "no access" screen with sign-out. _Why not
redirect to the frontend:_ silent cross-app redirects mask misconfigured role grants; an
explicit wall gets reported.

---

## 9. Code-splitting policy

- **Unit of splitting = route group**, via the route `lazy()` property above — React Router
  v7's data-API-native mechanism (fetches the module _during_ navigation, before render, so
  there is no render-then-suspend waterfall). `React.lazy` is reserved for **below-route**
  heavy islands: the TipTap editor bundle inside the editor route, the publish sheet, the
  analytics chart pack, AntD-heavy admin widgets.
- Expected chunk shape: `auth` (tiny) · `feed+piece` (core reading path, prefetched on idle
  from the landing page) · `editor` (largest — TipTap + extensions; **never** in the
  visitor-critical path) · `me/*` · `settings` · per-section admin chunks.
- Shared vendor chunks (`react`, router, TanStack Query, AntD core) split by Vite
  `manualChunks`; `@qalam/ui` tokens ship in the entry CSS so first paint is on-theme in
  both light and dark (ADR §6 dark mode is day one).

---

## 10. Route → API endpoint mapping (applied)

> Routes **navigate**; TanStack Query **fetches** (§header). This section maps each route to
> the **real, frozen `v1` endpoints** it drives (`05` is the contract; state keys in
> `12` §2). `/api/v1` prefix omitted. ⚠ marks an integration gap (§10.4).

| Route                             | Guard              | Lazy chunk   | Endpoints driven                                                                                                                                              |
| --------------------------------- | ------------------ | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/` (landing)                     | —                  | `landing`    | `GET /me` (redirect users → `/feed`)                                                                                                                          |
| `/feed?tab=`                      | — (following=auth) | `feed+piece` | `GET /feed/{following,latest,trending,discover}` (§10.1)                                                                                                      |
| `/p/:slug`                        | optional-auth      | `feed+piece` | `GET /pieces/:id` ⚠, `/pieces/:id/engagement`, `/comments`, `/responses`; `POST /analytics/pieces/:id/view`,`/read`                                           |
| `/search?q=&type=&…`              | optional-auth      | `search`     | `GET /search`, `/search/{pieces,writers,tags,genres,languages}`, `/autocomplete`, `/trending`, `/recent`; `DELETE /search/recent[/:id]`                       |
| `/tag/:slug`                      | —                  | `feed+piece` | `GET /feed/latest?tag=:slug`                                                                                                                                  |
| `/genre/:slug`                    | —                  | `feed+piece` | `GET /feed/latest?genre=:slug`                                                                                                                                |
| `/write`, `/write/:draftId`       | `RequireAuth`      | `editor`     | `POST /pieces`, `PATCH /pieces/:id`, `POST /pieces/:id/{preview,publish,schedule,archive,unarchive,duplicate,cover}`                                          |
| `/me/drafts`                      | `RequireAuth`      | `me/*`       | `GET /me/drafts`, `GET /me/pieces?status=`                                                                                                                    |
| `/me/stats?range=`                | `RequireAuth`      | `me/stats`   | `GET /analytics/{me,me/growth,readers/me,dashboard}`, `GET /analytics/pieces/:id`                                                                             |
| `/me/bookmarks`                   | `RequireAuth`      | `me/*`       | `GET /me/bookmarks`; `POST\|DELETE /pieces/:id/bookmarks`                                                                                                     |
| `/me/lists` ⚠                     | `RequireAuth`      | `me/*`       | **none — not built** (§10.4)                                                                                                                                  |
| `/me/collections`                 | `RequireAuth`      | `me/*`       | `GET/POST/PATCH/DELETE /collections[/:id]`, `GET/POST/DELETE /collections/:id/pieces`                                                                         |
| `/settings/profile`               | `RequireAuth`      | `settings`   | `GET/PATCH /me`, `POST /profile/avatar`,`/profile/cover`                                                                                                      |
| `/settings/account`               | `RequireAuth`      | `settings`   | `POST /auth/change-password`, `/auth/logout-all`                                                                                                              |
| `/settings/appearance`            | `RequireAuth`      | `settings`   | `GET/PATCH /settings` + local `useThemeStore`                                                                                                                 |
| `/auth/login`                     | `RequireGuest`     | `auth`       | `POST /auth/login`                                                                                                                                            |
| `/auth/register`                  | `RequireGuest`     | `auth`       | `POST /auth/register` (no live username check — §10.4)                                                                                                        |
| `/auth/forgot-password`           | `RequireGuest`     | `auth`       | `POST /auth/forgot-password`                                                                                                                                  |
| `/auth/reset-password?token=`     | `RequireGuest`     | `auth`       | `POST /auth/reset-password`                                                                                                                                   |
| `/auth/callback?code=`            | `RequireGuest`     | `auth`       | `POST /auth/google/exchange` (§10.2)                                                                                                                          |
| `/@:username?tab=`                | optional-auth      | `profile`    | `GET /users/:username`, `/followers`, `/following`; `POST\|DELETE /users/:id/follow`; `GET /me/follow-requests`, `PATCH /follow-requests/:id/{accept,reject}` |
| `/@:username/collections/:slug` ⚠ | —                  | `profile`    | owner-scoped only in `v1` (§10.4)                                                                                                                             |
| `/notifications`                  | `RequireAuth`      | `me/*`       | `GET /notifications`, `/unread-count`, `PATCH …/read`,`/read-all`,`/:id/archive`, `DELETE /:id`; `GET/PATCH /notification-preferences`                        |
| `*` (NotFound)                    | —                  | in shell     | none                                                                                                                                                          |

Verify-email lands on a public/guest route or a banner action → `POST /auth/verify-email`
`{ token }`; resend → `POST /auth/resend-verification`.

### 10.1 Feed tab ↔ endpoint path

The frontend URL is `/feed?tab=following|trending|latest|discover` (§5), but the **API is
path-based**:

```
?tab=       →  endpoint                 auth
following   →  GET /feed/following      JWT required
trending    →  GET /feed/trending       public
latest      →  GET /feed/latest         public
discover    →  GET /feed/discover  (+ GET /discover/{writers,pieces,tags,genres,languages})  public
```

`useFeedTab()` Zod-coerces `?tab=` to the default (`following` users / `discover` visitors);
the tab maps to the endpoint path **and** is the query-key discriminator (`qk.feed.list(tab)`,
`12` §2.1). Latest-feed filters (`?language=`, `?genre=`, `?tag=`) pass through to
`GET /feed/latest`; `/tag/:slug` and `/genre/:slug` are `latest` feeds with a fixed filter.
The server forces `sort=trending` on `/feed/trending` — don't send a client `sort` there.

### 10.2 Google OAuth is a redirect route, not a fetch

The two Google endpoints are the **only non-enveloped (302) responses**:

```
[Login] --click--▶ top-level navigation to GET /auth/google   (NOT a fetch)
   └─ Google consent
   └─ GET /auth/google/callback  (backend sets httpOnly refresh cookie)
        └─ 302 → ${VITE_APP_URL}/auth/callback?code=<oneTimeCode>
[/auth/callback route] (RequireGuest, spinner, no chrome)
   └─ POST /auth/google/exchange { code } → { accessToken } → memory
   └─ navigate(returnTo ?? "/feed", { replace: true })
```

Never `fetch('/auth/google')` — it must be a top-level navigation so the browser follows the
302 and stores the cookie. A failed exchange (`AUTH_OAUTH_FAILED`, `AUTH_OAUTH_STATE_INVALID`)
drops to `/auth/login` with an inline banner.

### 10.3 The `:id` types are not interchangeable

`POST\|DELETE /users/:id/follow` — `:id` = **target user UUID**.
`PATCH /follow-requests/:id/{accept,reject}` — `:id` = **follow-row UUID** (from
`GET /me/follow-requests`). `GET /users/:username`, `/followers`, `/following` take the
**username** string. Piece detail + sub-resources take the **piece UUID**. Route/hook code
must not conflate these.

### 10.4 Route ↔ API mismatches the frozen surface imposes

Recorded so route modules handle them honestly (`26` §11 lists all Phase-1 gaps); each
resolves via an **additive** backend endpoint (`docs/25` §8), never a frontend fake:

1. **`/p/:slug` cannot cold-load by slug** ⚠ — `GET /pieces/:id` takes a UUID; there is no
   public `slug → piece` endpoint. Navigating _from a list_ can pass the `id` (list items
   carry both). A shared link / hard refresh has only the slug and cannot resolve an id today
   (consistent with E5 Reading deferred). Build the reader against `GET /pieces/:id`; gate
   cold-load `/p/:slug` behind a future `GET /pieces/by-slug/:slug`. Never guess an id.
2. **`/me/lists`, reposts, quotes — not built** ⚠ (deferred E7). No endpoints; keep the IA
   slot reserved, do not register a live data route.
3. **Live username availability — no endpoint** ⚠ (`06` §3.7 wanted it). Validate the
   _format_ client-side against `USERNAME_REGEX`; surface _taken_ only on submit
   (`AUTH_USERNAME_TAKEN` → username field).
4. **Public collection `/@:u/collections/:slug`** ⚠ — collections are owner-scoped +
   `collection.manage` in `v1`; there is no public read, so this route fully works only for
   the owner in Phase 1.
