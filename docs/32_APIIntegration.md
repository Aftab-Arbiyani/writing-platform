# 32 — API Integration

> **Status:** Binding. **Derives from:** `05_APIStandards.md` (the frozen `v1` contract),
> `00_ArchitectureDecisions.md` §3 (token model) + §6 (centralized fetch wrapper),
> `12_StateManagement.md` §7 (auth/session), and the **as-implemented** scaffold at
> `frontend/src/lib/api-client.ts`. This document specifies how the frontend talks to the
> backend: the single HTTP client, auth/refresh, error handling, cancellation, uploads, and
> pagination. Query-cache policy is `12`; form-error mapping is `33`.

---

## 1. Decision: native `fetch`, not axios

The project brief lists "Axios". **The frozen architecture uses a native `fetch` wrapper**,
and this document follows the architecture:

- ADR §6 fixes a "**centralized typed `fetch` wrapper** (`lib/api-client.ts`) + per-feature
  query hooks; no ad-hoc fetches in components." Hard-rule #5 mandates `lib/api-client.ts`.
- The wrapper **already exists and is the scaffold's shape** (`request`, `get`, `post`,
  `patch`, `del`, `ApiError`). `axios` is **not** a workspace dependency.
- `fetch` covers everything the brief wants from axios: a central choke point (interceptors),
  request cancellation (`AbortController`), uploads (`FormData`), and typed errors — with a
  smaller bundle and one fewer dependency.

**Therefore: keep `fetch`. The "Axios" line in the brief is superseded by ADR §6.** Anyone
looking for "axios interceptor" / "axios instance" will find the equivalent here: §3
(interceptor), §2 (instance-equivalent module). Introducing axios would be a real change
against a frozen decision and requires an ADR amendment first (`docs/00`). Do not add it.

---

## 2. The client (`lib/api-client.ts`) — as implemented + Phase-1 additions

The scaffold already implements the core. **Existing** (do not rewrite — extend):

- `request<T>(path, init)` — the **only** place `fetch` is called. Sets `Accept:
application/json`; sets `Content-Type: application/json` when there is a body and none is
  set; sends **`credentials: 'include'`** (the httpOnly refresh/session cookies ride along);
  prefixes `env.VITE_API_URL`.
- **Envelope handling:** `204` → returns `undefined` (no body). Otherwise parses JSON; a
  non-JSON body → `ApiError('API_MALFORMED_RESPONSE')`. On `!response.ok || !body.success` →
  throws `ApiError` from `body.error` (or `API_UNEXPECTED_ERROR`). On success → **returns
  `body.data`** (the envelope is unwrapped; callers never see `{success,data}`).
- `get/post/patch/del<T>()` — thin verb helpers; `post/patch` `JSON.stringify` the body.
- **`ApiError`** (`extends Error`): `code: string`, `status: number`, `details: unknown[]`,
  `requestId?: string`. This is the single error type the whole app catches.

```ts
// The shape callers rely on (unchanged from the scaffold):
export class ApiError extends Error {
  readonly code: string; // @qalam/shared ERROR_CODES value — branch on THIS, never message
  readonly status: number; // HTTP status
  readonly details: unknown[]; // VALIDATION_FAILED field errors (33); [] otherwise
  readonly requestId: string | undefined; // X-Request-Id of the failed request (support)
}
```

**Phase-1 additions to the same module** (the scaffold does cookie-only today; ADR §3 +
`05` §7 require an in-memory access token + Bearer header + the refresh interceptor):

1. **In-memory access token** — a module-scoped variable, never `localStorage`, never a
   readable cookie (`12` §7).
   ```ts
   let accessToken: string | null = null;
   export function setAccessToken(t: string | null): void {
     accessToken = t;
   }
   export function getAccessToken(): string | null {
     return accessToken;
   }
   ```
2. **Bearer header injection** inside `request()`: if `accessToken` is set, add
   `Authorization: Bearer ${accessToken}`. (The refresh cookie still rides via
   `credentials:'include'` for the `/auth/refresh` call.)
3. **The 401 interceptor** (§3) — refresh-once, single-flight.
4. **`AbortSignal` pass-through** (§5) — `request()` forwards `init.signal` to `fetch`.

Everything else (per-feature `api/` hooks, query keys) builds on these helpers. **No
component or hook calls `fetch` or `request` directly** except the feature `api/` layer
(`03` §5 rule 8, `26` §7).

---

## 3. Authentication & the refresh interceptor

Model: `12` §7; contract: `05` §7. Web clients hold the **access token in JS memory** and the
**refresh token in an httpOnly `Secure` `SameSite=Lax` cookie** path-scoped to
`/api/v1/auth`. The interceptor lives inside `api-client.ts` (it _is_ the wrapper's response
handling), not in components.

### 3.1 Boot

```
App start → no access token in memory
  POST /auth/refresh   (empty body; cookie rides via credentials:'include')
    ├─ 200 → setAccessToken(data.accessToken); decode JWT for role hint (26 §8)
    │        → qk.auth.me resolves (GET /me) → guards render (11 §4)
    └─ 401 → visitor mode, no error UI (an expired/absent cookie is normal)
```

### 3.2 The 401 flow — refresh once, single-flight, never loop

```
request ──▶ response 401?
  ├─ no  → resolve (unwrap envelope)
  └─ yes → is this /auth/refresh itself?  ── yes → hard-logout path
            │ no
            ▼
     await the SINGLE in-flight refresh promise (concurrent 401s share ONE refresh)
            ├─ success → setAccessToken(new); retry the ORIGINAL request ONCE
            └─ failure → setAccessToken(null); queryClient.clear();
                         RequireAuth bounces to /auth/login?returnTo=… (11 §4)
```

Rules (all load-bearing):

- **Single-flight:** N parallel 401s await **one** refresh promise. Under refresh **rotation**
  (each refresh invalidates the prior token, `05` §7), a stampede would race — only the first
  rotation wins and the rest would trip `AUTH_REFRESH_REUSED` and revoke the whole family
  (`12` §7).
- **Retry once, never loop:** a request that 401s _after_ a fresh token is a real
  authorization failure, not expiry — do not refresh again.
- **Which 401s trigger refresh:** `AUTH_TOKEN_EXPIRED` → refresh-and-retry. All other 401
  codes (`AUTH_TOKEN_INVALID`, `AUTH_REFRESH_REUSED`, `AUTH_SESSION_REVOKED`) → straight to
  login. **403 is never retried** (`05` §4).
- **Logout:** `POST /auth/logout` → `setAccessToken(null)` → `queryClient.clear()` (cache is
  user-scoped) → reset non-theme Zustand stores. Theme survives (`12` §7).

```ts
// Single-flight refresh — the essential shape (inside api-client.ts):
let refreshPromise: Promise<string> | null = null;
async function refreshAccessToken(): Promise<string> {
  refreshPromise ??= post<{ accessToken: string }>('/auth/refresh')
    .then((data) => {
      setAccessToken(data.accessToken);
      return data.accessToken;
    })
    .finally(() => {
      refreshPromise = null;
    });
  return refreshPromise;
}
```

### 3.3 Google OAuth

A redirect dance, not a fetch (`11` §10.2): top-level navigation to `GET /auth/google` → Google →
`GET /auth/google/callback` (302 → `${VITE_APP_URL}/auth/callback?code=…`, cookie set) → the
`/auth/callback` route calls `POST /auth/google/exchange { code }` → `{ accessToken }` into
memory. These two callbacks are the only non-enveloped responses; never `fetch('/auth/google')`.

### 3.4 Mobile note (not this app)

The shared contract delivers tokens differently to Flutter (`refreshToken` in the response
**body**, keyed off an `X-Client: mobile` request header). The **web app never sends
`X-Client: mobile`** — it relies on the cookie. Documented only so the contract isn't
misread.

---

## 4. Error handling

Everything the client throws is an `ApiError`; the app branches on `.code` (never `.message`
— messages are for developers and may change, `05` §3).

| Layer                   | Handling                                                                                                                                                                                    |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Client**              | Throws `ApiError(status, {code, message, details, requestId})`. `204` → `undefined`. Malformed body → `API_MALFORMED_RESPONSE`.                                                             |
| **TanStack Query**      | Retries per `12` §2.6 (never on 4xx). 401 is the interceptor's job, not retry's.                                                                                                            |
| **Forms (400)**         | `VALIDATION_FAILED` → `error.details[]` mapped into RHF field errors via `applyServerErrors` (`33` §4).                                                                                     |
| **UI (4xx/5xx/domain)** | `error.code` → copy via `lib/error-messages.ts` (`06` §4.5). Field-level → inline; domain 422 → inline/toast; transport/5xx → in-place panel with `requestId` under a "Details" disclosure. |
| **429**                 | Respect `Retry-After` / `X-RateLimit-*`; **no auto-retry**; quiet "slow down" toast (`12` §2.6).                                                                                            |
| **Telemetry**           | 5xx already captured server-side with `requestId`; the client surfaces `requestId` for support and lets Sentry capture the render/uncaught path.                                            |

**Error → HTTP status semantics the client must honor** (`05` §4): 400 = field errors;
401 = refresh-or-login; 403 = "no", never retried; 404 = absent _or invisible_ (privacy —
show NotFound, never leak existence); 409 = state conflict (already published, idempotency
in-flight); 422 = domain rule violated (schedule in past, clap cap, self-follow); 503 =
dependency down, safe to retry with backoff.

**The error-code catalogue** the UI maps comes from `@qalam/shared` `ERROR_CODES` (auth,
user, piece, feed, search, media, engagement, collection, comment, notification families —
full list in the module surfaces). Unknown codes fall back to _"Something went wrong on our
side. Your work is safe."_

---

## 5. Request cancellation

Use `AbortController`; the client forwards `init.signal` to `fetch`. TanStack Query passes a
`signal` into every `queryFn` — thread it through:

```ts
// feature api/ hook
queryFn: ({ signal, pageParam }) =>
  api.get<Feed>(`/feed/${tab}`, { signal, /* ...query string... */ }),
```

- **Query cancellation is automatic** when the component unmounts or the key changes (TanStack
  aborts the signal). Always forward it — a stale search request must not resolve over a newer
  one.
- **Optimistic mutations** cancel in-flight queries in `onMutate`
  (`queryClient.cancelQueries({ queryKey })`) so a settling fetch doesn't clobber the
  optimistic value (`12` §2.5).
- A caught `AbortError` is **not** an application error — never toast it.

---

## 6. File uploads (avatars, covers, piece covers)

The frozen surface uploads via **`multipart/form-data`** to dedicated endpoints (there is no
pre-signed-URL flow in `v1` for these — the API accepts the file directly):

| Endpoint                 | Field  | Returns   | Raw cap                         |
| ------------------------ | ------ | --------- | ------------------------------- |
| `POST /profile/avatar`   | `file` | `{ key }` | 15 MB (5 MB effective, service) |
| `POST /profile/cover`    | `file` | `{ key }` | 15 MB (10 MB effective)         |
| `POST /pieces/:id/cover` | `file` | `{ key }` | 15 MB                           |

Rules:

- Build a `FormData`, append the file under the field name **`file`**, and **do not set
  `Content-Type`** — the browser sets `multipart/form-data; boundary=…` itself. The client's
  auto-JSON-Content-Type must be skipped for `FormData` bodies (guard on `body instanceof
FormData`).
  ```ts
  export function upload<T>(path: string, file: File, signal?: AbortSignal): Promise<T> {
    const form = new FormData();
    form.append('file', file);
    return request<T>(path, { method: 'POST', body: form, signal }); // no Content-Type set
  }
  ```
- Accepted types: JPEG/PNG/WebP. Enforce type + size **client-side before upload** for instant
  feedback; the server re-validates and re-encodes (strips EXIF/GPS, ADR §8) and can return
  `MEDIA_TYPE_UNSUPPORTED` (415) / `MEDIA_TOO_LARGE` (413).
- **Responses return an S3 _key_, not a URL** (`avatarKey`, `coverImageKey`, and the upload
  `{ key }`). **The client builds the CDN URL from the key** — e.g.
  `` `${VITE_CDN_URL}/${key}` ``. Centralize this in one helper (`lib/media.ts`
  `mediaUrl(key)`); never string-concatenate keys inline. (Add `VITE_CDN_URL` to
  `config/env.ts` + `.env.example` if not already present.)
- Show upload progress with a determinate control where possible; `fetch` has no native
  upload progress, so either accept an indeterminate state or (if progress is required) use
  `XMLHttpRequest` **inside `lib/`** only — still never in a component.

---

## 7. Pagination — the wire truth

Two models (`05` §5), never mixed on one endpoint. The reader app is almost entirely
**cursor**; offset is admin-only.

### 7.1 Cursor (feeds, timelines, comments, notifications, search lists)

- Query params: `?cursor=<opaque>&limit=20` (default 20, **max 50** — clamp client-side).
- **Wire shape (verified against the implemented interceptor):** pagination is nested at
  **`response.meta.pagination`**, _not_ `response.meta`:
  ```jsonc
  {
    "success": true,
    "data": [/* items */],
    "meta": { "pagination": { "nextCursor": "eyJrIjo…", "hasMore": true, "limit": 20 } },
  }
  ```
  Read `res.meta.pagination.nextCursor` (`null` = end). **Do not** read `res.meta` as the
  pagination object — the `@qalam/shared` `ApiSuccess.meta` type describes it that way, but the
  runtime nests it. If `@qalam/api-types` disagrees, trust the runtime and file a codegen fix.
- **Cursors are opaque**: never decode, construct, persist, or put in the URL (`11` §5,
  `12` §2.3). A stale/malformed cursor → `FEED_INVALID_CURSOR` (400) → restart from page one.
- Wire into `useInfiniteQuery` with `getNextPageParam: (last) =>
last.meta.pagination.nextCursor ?? undefined` (`12` §2.3).

### 7.2 Non-paginated list-shaped responses

`GET /search` (grouped), `/search/autocomplete`, `/search/trending`, `/search/recent`, all
`/analytics/*`, `/notification-preferences` return their payload as `data` with **no `meta`**
— use a plain `useQuery` (`12` §2.3).

### 7.3 Offset (admin app only)

`?page=1&limit=20` (max 100); `meta.pagination = { page, limit, total, totalPages }`. Not used
in the reader app.

---

## 8. Idempotency & request tracing

- **`Idempotency-Key` on publish** (`05` §9): `POST /pieces/:id/publish` accepts a
  client-generated UUID header. Generate **one key per user intent** (per tap of "Publish"),
  not per HTTP attempt — a retry with the same key + same payload replays the stored response
  (never double-publishes). This is the **only** mutation TanStack Query may retry (`12` §2.6).
  Same key + different payload → `422 VALIDATION_IDEMPOTENCY_MISMATCH`; same key while the
  first is in flight → `409`.
- **`X-Request-Id`** is echoed on every response and embedded in every error envelope
  (`ApiError.requestId`). Surface it in the error "Details" disclosure so a support ticket can
  be grepped across nginx → API → worker → Sentry (ADR §9). Do not log tokens/emails.
- **`X-RateLimit-*`** headers ride every response; the 429 path reads `Retry-After` (§4).

---

## 9. Query strings, filters, dates, booleans

Match the backend's DTO expectations (`05` §6):

- Filters are **flat query params** named after the field (`?language=ur&genre=ghazal&
tag=barish`); multi-value is **comma-separated, OR semantics** (`?language=hi,ur`).
- **Booleans are literal `true`/`false`** strings; **dates are ISO-8601 UTC**; enum-ish params
  (`tab`, `type`, `status`, `sort`, `kind`, `period`) validate against `@qalam/shared` enums.
- **Unknown params are rejected** by the backend (`forbidNonWhitelisted`) — send only declared
  params. Sort uses `?sort=field` / `-field` from each endpoint's whitelist.
- Build query strings in the feature `api/` layer with a small helper; never hand-concatenate
  `?a=${x}` in components.

---

## 10. The api layer contract (three layers, each mockable)

```
component ──uses──▶ feature query/mutation hook ──calls──▶ feature api/ module ──calls──▶ lib/api-client
 (renders)          (usePiece, useFeed, useClap)          (piecesApi.get(id))          (get/post/patch/del)
```

- **Components never fetch**; hooks never build URLs by hand outside `api/`; `api/` is the only
  place endpoints are named (`16` §4.2, §4.5). This is lint-enforced (`fetch` restricted
  outside `lib/`).
- **Types come from `@qalam/api-types`** (generated from `openapi.json`) — never hand-duplicate
  a wire type. When the backend contract changes, regenerate; CI fails on drift (`05` §10).
- **Testing:** mock at the boundary you own — hooks mock the `api/` layer; integration tests
  use **MSW** at the `fetch` boundary (`16` §7.4). Never mock `api-client` internals.

---

## 11. Checklist (per API integration)

```
□ All I/O via lib/api-client (get/post/patch/del) → feature api/ → hook → component; no fetch elsewhere
□ Access token in memory + Bearer header; refresh via single-flight 401 interceptor; retry once
□ credentials:'include' preserved (refresh cookie); logout clears token + queryClient
□ Errors caught as ApiError; branch on .code (not .message); 400→fields, 422→toast, 403 never retried
□ Cursor lists read meta.pagination.nextCursor; cursors opaque; limit clamped ≤50
□ Uploads: FormData field "file", no manual Content-Type; response {key} → mediaUrl(key)
□ Publish carries a per-intent Idempotency-Key; it is the only retried mutation
□ AbortSignal forwarded from queryFn; AbortError never toasted
□ Wire types from @qalam/api-types; query strings built in api/, enums from @qalam/shared
```
