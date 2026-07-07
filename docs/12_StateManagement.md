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
export const qk = {
  auth: {
    me: () => ['auth', 'me'] as const,
  },
  feed: {
    all: ['feed'] as const,
    list: (tab: FeedTab) => ['feed', 'list', tab] as const, // infinite (§2.3)
  },
  pieces: {
    all: ['pieces'] as const,
    detail: (slug: string) => ['pieces', 'detail', slug] as const,
    responses: (pieceId: string) => ['pieces', pieceId, 'responses'] as const,
  },
  profiles: {
    detail: (username: string) => ['profiles', username] as const,
    pieces: (username: string) => ['profiles', username, 'pieces'] as const,
  },
  me: {
    all: ['me'] as const,
    drafts: () => ['me', 'drafts'] as const,
    bookmarks: () => ['me', 'bookmarks'] as const,
    lists: () => ['me', 'lists'] as const,
    collections: () => ['me', 'collections'] as const,
    stats: (range: StatsRange) => ['me', 'stats', range] as const,
  },
  search: (params: SearchParams) => ['search', params] as const,
  taxonomy: {
    tags: () => ['taxonomy', 'tags'] as const,
    genres: () => ['taxonomy', 'genres'] as const,
    languages: () => ['taxonomy', 'languages'] as const,
  },
  notifications: {
    list: () => ['notifications', 'list'] as const,
    unreadCount: () => ['notifications', 'unread-count'] as const,
  },
} as const;
```

Keys are **data-shaped, not screen-shaped** (`["pieces","detail",slug]`, never
`["piece-page"]`) — three screens showing the same piece share one cache entry.

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
  queryKey: qk.feed.list(tab),
  queryFn: ({ pageParam }) => api.get('/feed', { tab, cursor: pageParam, limit: 20 }),
  getNextPageParam: (last) => last.meta.nextCursor ?? undefined, // opaque base64; null = end
  initialPageParam: undefined,
});
```

Cursors are opaque server tokens — the client never inspects, stores, or URL-encodes them
(doc 11 §5). Tab switches change the **key**, not the pages; each tab keeps its own page
stack, which is what makes Back-with-restored-scroll work.

### 2.4 Invalidation map

The canonical mutation → invalidation table. Every new mutation adds a row here **in the
same PR** — unlisted invalidation is the primary source of "stale UI" bugs.

| Mutation                             | Invalidates (prefix)                                                                                                       | Optimistic?                                                |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| clap / like / bookmark               | `qk.pieces.detail(slug)` — after settle; feed lists are _not_ invalidated (embedded counts refresh on their own 30 s tier) | **Yes** (§2.5)                                             |
| follow / unfollow / request          | `qk.profiles.detail(u)`, `qk.feed.list("following")`                                                                       | **Yes**                                                    |
| publish / unpublish                  | `qk.me.drafts()`, `qk.pieces.detail(slug)`, `qk.feed.all`, `qk.profiles.pieces(me)`                                        | No — server-authoritative (slug/status minted server-side) |
| draft autosave (PATCH)               | nothing — response written back via `setQueryData` (_Why:_ invalidating drafts every 2 s would thrash)                     | No                                                         |
| schedule / reschedule / cancel       | `qk.me.drafts()`                                                                                                           | No                                                         |
| collection create/update/add/reorder | `qk.me.collections()`, `qk.profiles.detail(me)`                                                                            | Reorder only                                               |
| reading-list create/add/remove       | `qk.me.lists()`, `qk.me.bookmarks()`                                                                                       | Yes                                                        |
| repost / quote                       | `qk.pieces.detail(slug)`, `qk.feed.list("following")`                                                                      | Repost yes; quote no (composer submit)                     |
| notifications mark-seen/read         | `qk.notifications.list()`, `qk.notifications.unreadCount()`                                                                | Yes (badge zeroes instantly)                               |
| settings (profile/account)           | `qk.auth.me()`, `qk.profiles.detail(me)`                                                                                   | No                                                         |
| report content                       | nothing (fire-and-confirm)                                                                                                 | No                                                         |
| login / logout / refresh-failure     | logout: `queryClient.clear()` — the whole cache is user-scoped                                                             | —                                                          |

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
