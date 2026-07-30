# 12 — State Management

> **Derives from:** `00_ArchitectureDecisions.md` §3 (auth token model), §5 (envelope,
> cursor pagination, idempotency, rate limits), §6 (TanStack Query v5 **only** for server
> state; Zustand v5 slices; RHF + Zod; URL via React Router). Flows: `09_UserFlows.md`.
> URL conventions: `11_RoutingArchitecture.md` §5.

---

## 1. The four-quadrant taxonomy

Every piece of state in both apps is classified into exactly one quadrant **before** any
code is written. "Where does this state live?" must never be a per-component judgment call.

| Quadrant            | Definition                                          | Owner (only)              | Examples                                                                           |
| ------------------- | --------------------------------------------------- | ------------------------- | ---------------------------------------------------------------------------------- |
| **Server state**    | Data the API owns; we hold a cache, never the truth | **TanStack Query v5**     | feed pages, piece, profile, notifications, `me`, taxonomy, analytics               |
| **Client/UI state** | Ephemeral, client-owned, cross-component            | **Zustand v5 slices**     | theme, editor chrome (focus mode, save status), session UI (banners, active modal) |
| **Form state**      | In-progress user input with validation lifecycle    | **React Hook Form + Zod** | register wizard, publish sheet, settings forms, report dialog                      |
| **URL state**       | Anything that changes _which view_ renders          | **React Router v7**       | `?tab=`, search filters, `?range=`, admin `?page=`                                 |

**The golden rule (ADR §6, verbatim intent): server state is never mirrored into Zustand.**
No "store the user in the store", no "copy feed items so we can tweak them". One cache, one
invalidation model. The moment server data is duplicated, the copy is stale by definition
and every bug report becomes "which copy won?".

Decision procedure: _Does the API know it?_ → Query. _Does the URL need it to reproduce the
view?_ → Router. _Is it inside a `<form>` lifecycle?_ → RHF. _Else, and only else_ → Zustand
(and if it's used by a single component — plain `useState`, not Zustand).

---

## 2. TanStack Query conventions

### 2.1 Hierarchical query-key factory

One factory per app in `src/lib/query-keys.ts`; ad-hoc key arrays are banned by review.
_Why a factory:_ invalidation targets prefixes — keys must be constructed, never typed.

```ts
// Grounded in the frozen v1 surface; each key notes the endpoint it fetches.
export const qk = {
  auth: {
    me: () => ['auth', 'me'] as const, // GET /me
  },

  // Feed — `tab` is the discriminator; the tab maps to an endpoint PATH (§2.1.1). Infinite.
  feed: {
    all: ['feed'] as const,
    list: (tab: FeedTab, filters?: FeedFilters) => ['feed', 'list', tab, filters ?? {}] as const, // GET /feed/{tab} — tab→path (§2.1.1)
  },
  // Discover rails (the Discover tab's editorial content — separate endpoints).
  discover: {
    writers: (kind: WriterKind) => ['discover', 'writers', kind] as const, // GET /discover/writers?kind=
    pieces: (kind: DiscoverPieceKind) => ['discover', 'pieces', kind] as const, // GET /discover/pieces?kind=
    tags: () => ['discover', 'tags'] as const, // GET /discover/tags
    genres: () => ['discover', 'genres'] as const, // GET /discover/genres
    languages: () => ['discover', 'languages'] as const, // GET /discover/languages
  },

  pieces: {
    all: ['pieces'] as const,
    detail: (id: string) => ['pieces', 'detail', id] as const, // GET /pieces/:id  (by UUID — §2.1.1)
    engagement: (id: string) => ['pieces', id, 'engagement'] as const, // GET /pieces/:id/engagement
    comments: (id: string) => ['pieces', id, 'comments'] as const, // GET /pieces/:id/comments (infinite)
    responses: (id: string) => ['pieces', id, 'responses'] as const, // GET /pieces/:id/responses (infinite)
  },
  comments: {
    replies: (commentId: string) => ['comments', commentId, 'replies'] as const, // GET /comments/:id/replies
  },

  profiles: {
    detail: (username: string) => ['profiles', username] as const, // GET /users/:username
    followers: (username: string) => ['profiles', username, 'followers'] as const, // GET /users/:username/followers
    following: (username: string) => ['profiles', username, 'following'] as const, // GET /users/:username/following
  },

  me: {
    all: ['me'] as const,
    drafts: () => ['me', 'drafts'] as const, // GET /me/drafts (infinite; status forced 'draft')
    pieces: (status?: PieceStatus) => ['me', 'pieces', status ?? 'all'] as const, // GET /me/pieces?status=
    bookmarks: () => ['me', 'bookmarks'] as const, // GET /me/bookmarks (infinite)
    followRequests: () => ['me', 'follow-requests'] as const, // GET /me/follow-requests (infinite)
    settings: () => ['me', 'settings'] as const, // GET /settings
    stats: (range: StatsRange) => ['me', 'stats', range] as const, // → GET /analytics/me* (see analytics)
  },

  collections: {
    list: () => ['collections', 'list'] as const, // GET /collections (infinite)
    detail: (id: string) => ['collections', id] as const, // GET /collections/:id
    pieces: (id: string) => ['collections', id, 'pieces'] as const, // GET /collections/:id/pieces (infinite)
  },

  // Search — params object is the key; recent/trending/autocomplete are their own keys.
  search: {
    global: (q: string) => ['search', 'global', q] as const, // GET /search?q=
    pieces: (params: SearchParams) => ['search', 'pieces', params] as const, // GET /search/pieces (infinite)
    writers: (params: SearchParams) => ['search', 'writers', params] as const, // GET /search/writers (infinite)
    tags: (q: string) => ['search', 'tags', q] as const, // GET /search/tags (infinite)
    genres: (q: string) => ['search', 'genres', q] as const, // GET /search/genres (infinite)
    languages: (q: string) => ['search', 'languages', q] as const, // GET /search/languages (infinite)
    autocomplete: (q: string, type: SearchType) => ['search', 'autocomplete', q, type] as const,
    trending: () => ['search', 'trending'] as const, // GET /search/trending
    recent: () => ['search', 'recent'] as const, // GET /search/recent
  },

  // Taxonomy catalogues — NO /taxonomy endpoints exist (§2.1.1). Sourced from search/discover.
  taxonomy: {
    genres: () => ['taxonomy', 'genres'] as const, // → GET /search/genres (q omitted = browse by usage)
    languages: () => ['taxonomy', 'languages'] as const, // → GET /search/languages (q omitted)
    tags: () => ['taxonomy', 'tags'] as const, // → GET /discover/tags (trending) / /search/tags
  },

  notifications: {
    list: (filters?: NotificationFilters) => ['notifications', 'list', filters ?? {}] as const, // GET /notifications
    unreadCount: () => ['notifications', 'unread-count'] as const, // GET /notifications/unread-count
    preferences: () => ['notifications', 'preferences'] as const, // GET /notification-preferences
  },

  analytics: {
    me: () => ['analytics', 'me'] as const, // GET /analytics/me
    readers: () => ['analytics', 'readers', 'me'] as const, // GET /analytics/readers/me
    dashboard: () => ['analytics', 'dashboard'] as const, // GET /analytics/dashboard
    growth: (period: AnalyticsPeriod, points: number) =>
      ['analytics', 'growth', period, points] as const, // GET /analytics/me/growth
    piece: (id: string) => ['analytics', 'piece', id] as const, // GET /analytics/pieces/:id
  },
} as const;
```

Keys are **data-shaped, not screen-shaped** (`["pieces","detail",id]`, never
`["piece-page"]`) — three screens showing the same piece share one cache entry.

### 2.1.1 Reconciliations with the frozen `v1` surface

This factory was originally sketched ahead of the backend freeze. Where it differed, the
**implemented surface wins** (`05` is the contract; `26` §9 maps every screen to its
endpoints):

1. **Piece is keyed by `id` (UUID), not `slug`.** `GET /pieces/:id` takes a UUID
   (`ParseUUIDPipe`); there is no public `slug → piece` endpoint. The reader resolves the
   piece object first, then keys every sub-resource (`engagement`, `comments`, `responses`,
   analytics) by `piece.id`. Cold-loading `/p/:slug` needs an additive endpoint (`11` §5.1).
2. **Feed is per-tab endpoint paths**, not `GET /feed?tab=`. `qk.feed.list(tab)` holds — the
   `tab` maps to `/feed/{following|latest|trending|discover}` in the `api/` layer (`11` §5.x).
3. **Taxonomy has no dedicated endpoints.** `qk.taxonomy.*` resolves to `search`/`discover`
   calls; cache it at the **Taxonomy tier (1h)** regardless.

### 2.2 `staleTime` tiers

Defaults per data class, set in the per-feature hook — components never pass `staleTime`.

| Tier     | `staleTime` | Applies to                           | Why                                                                        |
| -------- | ----------- | ------------------------------------ | -------------------------------------------------------------------------- |
| Live     | **30 s**    | feed lists, notifications list/count | Social freshness; refetch-on-focus does the rest                           |
| Content  | **5 min**   | piece detail, responses              | Published prose barely changes; readers navigate back and forth constantly |
| Identity | **1 min**   | profiles, `auth.me`, `me.*`          | Follower counts and own drafts change at human speed                       |
| Taxonomy | **1 h**     | tags/genres/languages catalogues     | Admin-curated; effectively static within a session                         |

`gcTime` ≥ 15 min everywhere so Back-navigation (doc 11 §7) renders instantly from cache.

### 2.3 Infinite queries — feeds & cursor pagination

Every timeline (`feed.list`, profile pieces, responses, notifications, search results) is a
`useInfiniteQuery` over the ADR §5 cursor contract:

```ts
useInfiniteQuery({
  queryKey: qk.feed.list(tab, filters),
  queryFn: ({ pageParam, signal }) =>
    api.get(`/feed/${tab}`, { cursor: pageParam, limit: 20, ...filters }, { signal }),
  // WIRE TRUTH: pagination is nested at meta.pagination (NOT meta directly) — the
  // implemented transform interceptor returns meta: { pagination: CursorMeta }.
  getNextPageParam: (last) => last.meta.pagination.nextCursor ?? undefined, // opaque; null = end
  initialPageParam: undefined,
});
```

`CursorMeta` = `{ nextCursor: string | null, hasMore: boolean, limit: number }`; `limit`
default 20, **max 50** (clamp client-side). Cursors are opaque server tokens — the client
never inspects, stores, or URL-encodes them (doc 11 §5); a stale/malformed cursor returns
`FEED_INVALID_CURSOR` (400) → restart from page one. Tab switches change the **key**, not the
pages; each tab keeps its own page stack, which is what makes Back-with-restored-scroll work.
**Non-paginated list-shaped responses** (`GET /search` grouped, `/search/autocomplete`,
`/search/trending`, `/search/recent`, all `/analytics/*`, `/notification-preferences`) return
`data` with **no `meta`** — use a plain `useQuery`, not infinite.

Infinite endpoints (cursor): `feed/*`, `discover/*` rails, `me/drafts`, `me/pieces`,
`me/bookmarks`, `me/follow-requests`, `collections` + `collections/:id/pieces`,
`pieces/:id/comments`, `comments/:id/replies`, `pieces/:id/responses`,
`users/:username/followers|following`, `notifications`, and `search/{pieces,writers,tags,
genres,languages}`.

### 2.4 Invalidation map

The canonical mutation → invalidation table. Every new mutation adds a row here **in the
same PR** — unlisted invalidation is the primary source of "stale UI" bugs. Grounded in the
frozen `v1` mutations (keys are by `id`, §2.1.1):

| Mutation (endpoint)                                                    | Invalidates (prefix)                                                                                                    | Optimistic?                      |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| like / unlike (`POST\|DELETE /pieces/:id/likes`)                       | `qk.pieces.engagement(id)`, `qk.pieces.detail(id)` — feed lists **not** invalidated (embedded counts refresh 30 s tier) | **Yes** (§2.5)                   |
| clap / remove claps (`POST\|DELETE /pieces/:id/claps`)                 | `qk.pieces.engagement(id)` after settle                                                                                 | **Yes** (batched)                |
| bookmark / unbookmark (`POST\|DELETE /pieces/:id/bookmarks`)           | `qk.pieces.engagement(id)`, `qk.me.bookmarks()`                                                                         | **Yes**                          |
| comment / reply (`POST /pieces/:id/comments`, `/comments/:id/replies`) | `qk.pieces.comments(id)` or `qk.comments.replies(parentId)`, `qk.pieces.engagement(id)`                                 | No (composer submit)             |
| edit / delete comment (`PATCH\|DELETE /comments/:id`)                  | `qk.pieces.comments(pieceId)` (+ replies key if threaded)                                                               | Delete: Yes (tombstone)          |
| follow / unfollow (`POST\|DELETE /users/:id/follow`)                   | `qk.profiles.detail(u)`, `qk.feed.list("following")`                                                                    | **Yes** (Following/Requested)    |
| accept / reject request (`PATCH /follow-requests/:id/*`)               | `qk.me.followRequests()`, `qk.profiles.detail(me)`, `qk.feed.list("following")`                                         | Yes                              |
| create draft (`POST /pieces`)                                          | `qk.me.drafts()`                                                                                                        | No                               |
| draft autosave (`PATCH /pieces/:id`)                                   | **nothing** — written back via `setQueryData(qk.pieces.detail(id))` (invalidating every 1.5 s would thrash)             | No                               |
| publish / archive / unarchive (`POST /pieces/:id/*`)                   | `qk.me.drafts()`, `qk.me.pieces()`, `qk.pieces.detail(id)`, `qk.feed.all`, `qk.profiles.*(me)`                          | No — server-authoritative        |
| schedule (`POST /pieces/:id/schedule`)                                 | `qk.me.drafts()`                                                                                                        | No                               |
| delete piece (`DELETE /pieces/:id`)                                    | `qk.me.drafts()`, `qk.me.pieces()`, `qk.feed.all`, `qk.profiles.*(me)`                                                  | No (undo toast)                  |
| duplicate (`POST /pieces/:id/duplicate`)                               | `qk.me.drafts()`                                                                                                        | No                               |
| collection create/update/delete (`/collections[/:id]`)                 | `qk.collections.list()`, `qk.profiles.detail(me)`                                                                       | No                               |
| add/remove collection piece (`/collections/:id/pieces[...]`)           | `qk.collections.detail(id)`, `qk.collections.pieces(id)`, `qk.collections.list()`                                       | Add: Yes                         |
| share (`POST /pieces/:id/shares`)                                      | `qk.pieces.engagement(id)`                                                                                              | No (fire-and-confirm)            |
| notifications read / read-all / archive / delete                       | `qk.notifications.list()`, `qk.notifications.unreadCount()`                                                             | **Yes** (badge zeroes instantly) |
| notification preferences (`PATCH /notification-preferences`)           | `qk.notifications.preferences()`                                                                                        | No                               |
| settings (`PATCH /settings`)                                           | `qk.me.settings()` (theme handled by `useThemeStore`, not a query)                                                      | No                               |
| profile update / avatar / cover (`PATCH /me`, `/profile/*`)            | `qk.auth.me()`, `qk.profiles.detail(me)`                                                                                | No                               |
| record view/read (`POST /analytics/pieces/:id/{view,read}`)            | **nothing** (204 fire-and-forget; own stats refresh on their 1 min tier)                                                | No                               |
| login / logout / refresh-failure                                       | logout/failure: `queryClient.clear()` — the whole cache is user-scoped                                                  | —                                |

> **Not built in `v1`** (deferred E7): **reading lists, reposts, quotes** have no endpoints —
> their rows are removed until the backend adds them (`26` §11). **`report content`** has no
> endpoint in the reader-app surface either. Do not wire mutations for these.

### 2.5 Optimistic updates — clap / like / bookmark / follow

Shared recipe (one `useOptimisticMutation` helper; per-action deltas):

```ts
onMutate: async (vars) => {
  await queryClient.cancelQueries({ queryKey: key });        // don't race in-flight fetches
  const prev = queryClient.getQueryData(key);                // snapshot
  queryClient.setQueryData(key, applyDelta(vars));           // e.g. claps += Δ (clamped 50)
  return { prev };
},
onError: (_e, _v, ctx) => queryClient.setQueryData(key, ctx.prev),  // visible rollback
onSettled: () => queryClient.invalidateQueries({ queryKey: key }),  // truth wins
```

Per-action specifics:

| Action   | Optimistic delta                                                                                     | Reconciliation                                                                                                      |
| -------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Clap     | Local counter per tap; **one mutation per 600 ms burst** carrying the accumulated Δ (doc 09 Flow 8a) | Server returns authoritative per-user total (≤ 50) → written back; multi-device taps converge                       |
| Like     | Toggle flag + count ±1                                                                               | Toggle mutations are keyed per piece with the latest state winning (no queuing of stale toggles)                    |
| Bookmark | Toggle flag; row appears/disappears in `me.bookmarks` cache                                          | Rollback restores the row's position                                                                                |
| Follow   | Button state (`Following` / `Requested` for private accounts) + follower count                       | Server response distinguishes `accepted` vs `pending` — UI corrects if the optimistic guess about privacy was wrong |

Only trivially reversible actions are optimistic (doc 09 cross-flow invariant 1).

### 2.6 Retry policy & devtools

| Concern          | Policy                                                                                                                                                                                   |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Query retries    | 2 retries, exponential backoff (1 s, 3 s) — but **never** on 4xx: `retry: (n, err) => n < 2 && !(err.status >= 400 && err.status < 500)`. 401 is the interceptor's job (§7), not retry's |
| Mutation retries | **0** by default. Publish may retry once because it carries an `Idempotency-Key` (ADR §5) — the only mutation where retry is provably safe                                               |
| Refetch triggers | `refetchOnWindowFocus: true` for Live tier; off for Content/Taxonomy. `refetchOnReconnect: true` globally                                                                                |
| 429 handling     | Respect `X-RateLimit-*`/`Retry-After`; no automatic retry — surface a quiet "slow down" toast                                                                                            |
| Devtools         | `@tanstack/react-query-devtools` mounted in dev builds only (`import.meta.env.DEV`); lazy-imported so it never ships                                                                     |

---

## 3. Zustand — client/UI state

**Slice-per-concern, no global god-store.** Each feature owns its store file under
`features/<name>/stores/`; app-wide slices live in `src/stores/`. Stores never import each
other (_Why:_ a web of store→store imports is Redux-without-the-devtools).

| Store               | State                                                                                                   | Persisted?                                                                                                                                                                                 |
| ------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `useThemeStore`     | `theme: "light" \| "dark" \| "system"`, resolved theme                                                  | **Yes** — the _only_ persisted store (`persist` middleware → `localStorage["qalam-theme"]`); an inline head script applies it pre-paint to prevent theme flash (ADR §6: dark mode day one) |
| `useSessionUiStore` | active modal id, dismissed banner ids, mobile-nav open                                                  | No — session-scoped by design                                                                                                                                                              |
| `useEditorUiStore`  | save status (`saved \| saving \| offline-error`), focus mode, publish-sheet step, active footnote panel | No — and **never document content** (§5)                                                                                                                                                   |

Rules:

1. **Selector discipline — subscribe narrow.** Always `useThemeStore(s => s.theme)`; bare
   `useThemeStore()` re-renders on every slice change and is banned by lint rule.
   Multi-field reads use `useShallow`.
2. Actions live **inside** the store (`toggleFocusMode()`), components never `setState`
   with object spreads — the store is an API, not a mutable bag.
3. No async in stores. Anything async is a mutation (server state) — the store only holds
   the resulting UI flag.
4. Persisting anything beyond theme requires an ADR note; reading-position uses
   `sessionStorage` directly (doc 11 §7) and auth tokens are never persisted (§7).

---

## 4. Form state — React Hook Form + Zod

- **Schema colocated with the form**, in the feature: `features/auth/schemas/register.schema.ts`.
  The component imports the schema; the schema imports domain atoms (`USERNAME_REGEX`,
  limits) from `@qalam/shared`. Where the backend validates the same shape, the schema is
  built from **shared primitives via `@qalam/api-types`** so FE and BE cannot drift —
  the request _types_ are generated from OpenAPI; the Zod _rules_ share the same
  `@qalam/shared` constants both sides import. One vocabulary, two enforcers (ADR §3: Zod
  everywhere).
- `useForm({ resolver: zodResolver(schema), mode: "onTouched" })` — validate on blur first,
  then on change after first error (calm, not naggy).
- **Server error mapping.** The API error envelope (§5 ADR) carries field-level `details`;
  the api-client maps them into RHF:

```ts
// lib/forms/apply-server-errors.ts
export function applyServerErrors<T extends FieldValues>(err: ApiError, form: UseFormReturn<T>) {
  for (const d of err.details ?? []) {
    form.setError(d.field as Path<T>, { type: 'server', message: d.message });
  }
  if (!err.details?.length)
    // non-field errors → form-level banner
    form.setError('root.server', { message: messageFor(err.code) });
}
```

Field errors land inline (username taken → under the username field, doc 09 Flow 1);
code-only errors (`AUTH_INVALID_CREDENTIALS`) render as a form-level banner via
`errors.root.server`. Error **copy** is keyed by `code` client-side — server messages are
for developers, not UI.

- Wizard forms (register): one RHF instance across steps, per-step `trigger()` gating;
  submit fires once, atomically (doc 09 Flow 1).
- Forms never touch Zustand or Query caches while in progress; on success the mutation's
  invalidation row (§2.4) refreshes the world.

---

## 5. Editor state — TipTap owns the document

**TipTap (ProseMirror) is the single owner of document state.** The editor's content
**never enters React state per keystroke** — no `onChange={setContent}`, ever.

_Why:_ ProseMirror already maintains a transactional, immutable document model with its own
efficient view reconciliation. Mirroring it into `useState`/Zustand would (a) re-render the
React tree on every keystroke — fatal for long pieces and demanding Nastaliq shaping,
(b) create a second source of truth for the one artifact this product exists to protect,
and (c) fight ProseMirror's transaction pipeline (IME/RTL input, collaborative-editing
later). React components read the document _on demand_ via the editor instance
(`editor.getJSON()`) at autosave/preview/publish moments only.

### 5.1 Autosave pipeline (doc 09 Flow 5)

```
 keystroke → TipTap transaction (internal)
     │  editor.on("update") — no React re-render
     ▼
 debounce 2 s (trailing) ──▶ draftMutation.mutate({ id, content: editor.getJSON() })
     │                              │ PATCH /api/v1/pieces/:id
     ▼                              ▼
 useEditorUiStore.saveStatus:   onSuccess → "saved" (+ setQueryData on qk.me.drafts entry)
   "saving"                     onError (network) → "offline-error" + retry backoff loop
                                onError (409 stale) → conflict banner (no silent overwrite)
```

Status chip states: `saved` ("Saved · 21:04") · `saving` ("Saving…") · `offline-error`
("Offline — changes not saved yet", amber, retries every 10 s; content is safe **inside
the live editor**, so nothing is lost while the tab lives). A `beforeunload` guard warns
only when status ≠ `saved`. Only the latest snapshot is in flight — a newer debounce
supersedes an unresolved save rather than queuing behind it.

The editor **route** is still server-state-driven: the draft loads through
`useQuery(qk.pieces.detail(...))` once, hydrates TipTap, and from then on TipTap is
authoritative until publish.

---

## 6. URL state

Owned entirely by React Router; conventions specified in `11_RoutingArchitecture.md` §5.
From the state perspective only two rules matter: (1) URL params are read through validated
hooks (`useFeedTab()`, `useSearchFilters()`) that Zod-coerce garbage to defaults — raw
`searchParams.get()` in components is banned; (2) URL params feed query keys directly
(`qk.feed.list(tab)`) — the URL changes, the key changes, the cache does the rest. No
effect-based syncing anywhere.

---

## 7. Auth/session state

| Element                        | Home                                                                       | Why                                                                                                           |
| ------------------------------ | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Access token (15 min)          | **JS memory only** — a module-scoped variable in `lib/api-client.ts`       | Not in Zustand (no reason for reactivity), not in `localStorage` (XSS exfiltration), not in a readable cookie |
| Refresh token (30 d, rotating) | **httpOnly `Secure` `SameSite=Lax` cookie**, path-scoped to `/api/v1/auth` | Invisible to JS by design (ADR §3); browser attaches it only to auth endpoints                                |
| "Who am I"                     | **A query: `qk.auth.me()`** — not a store                                  | Session identity _is server state_; the golden rule applies to it first                                       |

**Boot:** api-client has no token → `POST /auth/refresh` (cookie flies) → access token into
memory → `qk.auth.me` resolves → guards render (doc 11 §4). Refresh fails → visitor mode;
no error UI (an expired cookie is a normal Tuesday).

**401 interceptor — refresh → retry-once:**

```
 request ──▶ 401?
              ├─ no  → resolve
              └─ yes → is this /auth/refresh itself? ── yes → hard logout path
                        │ no
                        ▼
              single-flight refresh (concurrent 401s await ONE refresh promise)
                        ├─ success → replace in-memory token → retry original ONCE
                        └─ failure → queryClient.clear() → RequireAuth bounces to
                                     /auth/login?returnTo=… (doc 11 §4)
```

Retry-once, never loops: a request that 401s _after_ a fresh token is a real authorization
failure, not expiry. The single-flight promise prevents the classic stampede of N parallel
queries each triggering a refresh (which, under **rotation**, would race: only the first
rotation wins and the rest would trip reuse detection — doc 09 Flow 3.4).

**Logout:** `POST /auth/logout` (revokes + clears cookie) → null the in-memory token →
`queryClient.clear()` → reset non-theme Zustand stores. Theme survives logout — it's a
device preference, not an account one.

---

## 8. Anti-patterns table

| Anti-pattern                                                  | Why it's banned                                                              | Do instead                                                                  |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Copying server data into Zustand ("user store", "feed store") | Two sources of truth; stale copies win bug lotteries                         | Read from the query; derive in selectors/`useMemo`                          |
| Ad-hoc `useQuery(["feed", …])` string keys in components      | Unreachable by invalidation; typo-prone                                      | `qk.*` factory only (§2.1)                                                  |
| `useEffect`-fetch + `useState`                                | Reimplements TanStack Query badly: no cache, no dedup, race conditions       | Per-feature query hook over `lib/api-client.ts` (ADR §6: no ad-hoc fetches) |
| Syncing URL ⇄ state with effects                              | Feedback loops, double renders, back-button bugs                             | URL **is** the state; read params into query keys (§6)                      |
| Editor content in React state per keystroke                   | Re-renders the tree per character; second source of truth for the manuscript | TipTap owns it; read via `editor.getJSON()` on demand (§5)                  |
| Access token in `localStorage`/readable cookie                | XSS-exfiltratable; violates ADR §3 token model                               | In-memory + httpOnly refresh cookie (§7)                                    |
| Bare `useStore()` subscriptions                               | Re-render on every slice change                                              | Narrow selectors + `useShallow` (§3)                                        |
| Optimistic updates on publish/schedule/report                 | Not reversible; server mints slug/status/ids                                 | Await server; show pending state (doc 09 invariant 1)                       |
| Invalidating `qk.me.drafts()` on every autosave               | 2 s-interval refetch storm                                                   | `setQueryData` write-back; invalidate on lifecycle events only (§2.4)       |
| Global "app store" aggregating slices                         | God-store: every concern coupled, every render suspect                       | Slice-per-concern files; stores never import stores (§3)                    |
| Retrying mutations without an `Idempotency-Key`               | Duplicate side effects (double publish, double report)                       | Retry only idempotent-keyed mutations (§2.6)                                |
| Persisting Zustand slices by default                          | Stale UI resurrection after deploys; token-leak foot-gun                     | Persist theme only; everything else rebuilds from server/URL (§3)           |

---

## 9. Ownership summary

```
        URL (Router)                    Server (TanStack Query)
  which view am I looking at?      what does the truth currently say?
  ?tab= ?q= ?range= /p/:slug       qk.* caches ← api-client ← /api/v1
            │                                   ▲
            └── params feed query keys ─────────┘
        Forms (RHF + Zod)               UI (Zustand slices)
  what is being typed right now?   how is it being shown?
  register · publish sheet         theme · save status · focus mode
        Editor (TipTap)
  the manuscript itself — read on demand, saved on debounce
```

Five owners, zero overlaps. Any state that seems to need two owners is two different states
wearing one name — split it.
