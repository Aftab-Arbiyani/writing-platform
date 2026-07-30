# 05 — API Standards

> **Derives from:** `00_ArchitectureDecisions.md` §5 (API Standards) and §3 (Backend).
> This document is the contract every controller, client, and codegen consumer follows.
> The exported OpenAPI spec is the machine-readable form of this contract.

- **Style:** REST over JSON · base path **`/api/v1`** · dev port `4000` · docs at `/docs` (non-prod)
- **Consumers:** web app, admin app (both via `@qalam/api-types`), Flutter (Dart codegen) — one spec, three clients.

---

## 1. Resource conventions

| Rule                     | Convention                                               | Example                                              |
| ------------------------ | -------------------------------------------------------- | ---------------------------------------------------- |
| Resources                | plural nouns                                             | `/pieces`, `/collections`, `/reading-lists`          |
| Paths                    | **kebab-case**                                           | `/reading-lists`, `/card-templates`                  |
| JSON keys                | **camelCase** (request and response)                     | `penName`, `publishedAt`, `readingTimeSeconds`       |
| Identifiers in URLs      | `slug` / `username`, never raw UUIDs on public resources | `GET /pieces/:slug`, `GET /users/:username`          |
| Sub-resources            | one level max                                            | `GET /pieces/:slug/responses`                        |
| Actions that aren't CRUD | POST to a sub-resource noun                              | `POST /pieces/:id/publish`, `POST /pieces/:id/claps` |
| Partial update           | `PATCH` (JSON merge semantics per DTO)                   | `PATCH /me/profile`                                  |
| Replace                  | `PUT` only where full replacement is real                | rare; prefer PATCH                                   |
| Filtering/search         | query params, never request bodies on GET                | `GET /search?q=…&language=ur`                        |

**Why URI versioning (`/api/v1`) over header versioning.** A version in the URI is visible
in logs, curl-able without ceremony, bookmarkable, and cache-friendly (CDNs and proxies key
on URL by default). Header versioning is invisible: every debugging session starts with
"which version did you actually hit?", and cache keys need custom `Vary` handling. URI
versioning is boring and correct; we optimize for boring. NestJS `URI` versioning is
enabled globally in `main.ts`; `v1` is the default version for every controller.

---

## 2. Response envelope

Exactly as fixed in the ADR — every endpoint, no exceptions (including errors thrown
before routing, via the global exception filter):

```jsonc
// success
{ "success": true,  "data": …, "meta": { /* pagination etc. */ } }

// failure
{ "success": false, "error": { "code": "PIECE_NOT_FOUND", "message": "…", "details": [], "requestId": "…" } }
```

Rules:

- `data` is an object or array — never a bare scalar (extensibility: adding a sibling
  field must never be a breaking change).
- `meta` is present when there is metadata to convey (pagination, always on list
  endpoints); omitted otherwise.
- `error.details` is always an array (empty when not a validation error) — clients can
  iterate unconditionally.
- `error.requestId` always carries the `X-Request-Id` of the failed request (§9).
- `204 No Content` responses (deletes, un-likes) have **no body** — the envelope applies
  to responses that have one.

Success example:

```json
{
  "success": true,
  "data": {
    "id": "0198c9a1-7e2b-7cc3-9f1a-2b4d8e6f0a11",
    "slug": "raat-ki-baarish",
    "title": "رات کی بارش",
    "language": { "code": "ur", "direction": "rtl" },
    "publishedAt": "2026-07-04T18:30:00.000Z"
  },
  "meta": {}
}
```

---

## 3. Error codes

### 3.1 Conventions

- Format: **`DOMAIN_REASON`** — SCREAMING_SNAKE, domain prefix first.
- Single source of truth: `packages/shared/src/error-codes.ts` (`@qalam/shared`), exported
  as a `const` object — backend throws them (`AppException` subclasses), web/Flutter map
  them to localized messages. **Clients branch on `code`, never on `message`** — messages
  are for humans and may change without notice; codes are contract.
- HTTP status stays meaningful alongside the code (§4): status tells the _class_ of
  failure, code tells the _exact_ failure.
- A code is never reused with a different meaning, and never removed within a major API
  version — only deprecated and left in place.

### 3.2 Starter catalogue

| Code                              | HTTP | Meaning                                                                                               |
| --------------------------------- | ---- | ----------------------------------------------------------------------------------------------------- |
| `AUTH_INVALID_CREDENTIALS`        | 401  | email/password mismatch (deliberately does not say which)                                             |
| `AUTH_TOKEN_EXPIRED`              | 401  | access token expired — client should refresh                                                          |
| `AUTH_TOKEN_INVALID`              | 401  | malformed/forged/missing token                                                                        |
| `AUTH_REFRESH_REUSED`             | 401  | refresh reuse detected — token family revoked, full re-login required                                 |
| `AUTH_EMAIL_TAKEN`                | 409  | registration: email already registered                                                                |
| `AUTH_USERNAME_TAKEN`             | 409  | registration: username already held (permanently — includes deleted accounts)                         |
| `AUTH_EMAIL_UNVERIFIED`           | 403  | action requires a verified email                                                                      |
| `AUTH_FORBIDDEN`                  | 403  | authenticated but role/ownership insufficient (generic; prefer a specific code where one exists)      |
| `USER_NOT_FOUND`                  | 404  | no such username                                                                                      |
| `USER_PRIVATE_ACCOUNT`            | 403  | target account is private and the viewer doesn't follow                                               |
| `USER_SUSPENDED`                  | 403  | account suspended by moderation                                                                       |
| `USER_USERNAME_IMMUTABLE`         | 422  | attempted username change — usernames are permanent                                                   |
| `USER_SELF_FOLLOW`                | 422  | cannot follow yourself                                                                                |
| `PIECE_NOT_FOUND`                 | 404  | no such piece, or not visible to the viewer (private/unlisted rules — deliberately indistinguishable) |
| `PIECE_FORBIDDEN`                 | 403  | not the author (edit/delete/stats of someone else's piece)                                            |
| `PIECE_ALREADY_PUBLISHED`         | 409  | publish called on a published piece                                                                   |
| `PIECE_NOT_PUBLISHED`             | 409  | engagement attempted on a draft/archived piece                                                        |
| `PIECE_SCHEDULE_IN_PAST`          | 422  | `scheduledAt` must be in the future                                                                   |
| `PIECE_CLAP_LIMIT`                | 422  | clap total would exceed 50 per user per piece                                                         |
| `FEED_INVALID_CURSOR`             | 400  | cursor failed to decode/verify — client must restart from page one                                    |
| `FEED_UNKNOWN_TAB`                | 400  | `tab` not one of `following\|trending\|latest\|discover`                                              |
| `SEARCH_QUERY_TOO_SHORT`          | 400  | `q` under minimum length (2 chars)                                                                    |
| `SEARCH_UNAVAILABLE`              | 503  | search backend degraded — retry with backoff                                                          |
| `MEDIA_TYPE_UNSUPPORTED`          | 415  | content type not in the allowlist                                                                     |
| `MEDIA_TOO_LARGE`                 | 413  | above size cap for the media class                                                                    |
| `MEDIA_UPLOAD_EXPIRED`            | 410  | pre-signed URL expired — request a new one                                                            |
| `RATE_LIMITED`                    | 429  | sliding-window limit hit (§8)                                                                         |
| `VALIDATION_FAILED`               | 400  | DTO/shape validation failed — see `details`                                                           |
| `VALIDATION_IDEMPOTENCY_MISMATCH` | 422  | `Idempotency-Key` reused with a different payload (§9)                                                |

---

## 4. HTTP status usage

| Status    | Used for                                                                               |
| --------- | -------------------------------------------------------------------------------------- |
| 200       | successful GET/PATCH; POST that performs an action (publish, clap)                     |
| 201       | POST that creates a resource (`/pieces`, `/auth/register`)                             |
| 204       | successful DELETE / un-follow / un-like — no body                                      |
| 400       | malformed request: shape validation, bad cursor, unparsable query                      |
| 401       | **who are you?** — missing, invalid, expired credentials; refresh reuse                |
| 403       | **I know who you are, and no** — role, ownership, privacy, suspension                  |
| 404       | resource absent _or invisible to this viewer_ (privacy-preserving)                     |
| 409       | state conflict: duplicate email/username, already published, idempotency in-flight     |
| 410       | resource permanently gone (expired pre-signed upload)                                  |
| 413 / 415 | media too large / unsupported type                                                     |
| 422       | well-formed but violates a domain rule (schedule in past, clap cap, self-follow)       |
| 429       | rate limited — with `Retry-After`                                                      |
| 500       | unhandled fault — envelope with `requestId`, no internals leaked, Sentry gets the rest |
| 503       | dependency down (search, storage) — safe to retry with backoff                         |

**400 vs 422:** 400 = "I could not accept the shape of this request" (class-validator);
422 = "the request is valid but the domain says no". Clients show field errors for 400
`VALIDATION_FAILED` and toast/inline messages for 422 domain codes.

**401 vs 403:** 401 always and only means the credential is absent/invalid/expired — the
client's correct reaction is refresh-or-login. 403 means the identity is established and
the answer is no — retrying with the same account is pointless. Never return 403 for a
missing token.

### Validation `details` format

`VALIDATION_FAILED` carries a field-level array; every entry is machine-usable:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Request validation failed",
    "details": [
      { "field": "email", "rule": "isEmail", "message": "email must be a valid email address" },
      {
        "field": "username",
        "rule": "matches",
        "message": "username must match ^[a-z0-9_]{3,30}$"
      },
      {
        "field": "tags[5]",
        "rule": "arrayMaxSize",
        "message": "tags must contain at most 5 elements"
      }
    ],
    "requestId": "0198c9b2-4d1e-7aa0-b3c2-91f0e2d4c8a7"
  }
}
```

`field` uses dot/bracket paths for nested DTOs (`profile.penName`, `tags[5]`). `rule` is
the class-validator constraint name — stable enough for clients to map to localized copy.

---

## 5. Pagination

Two models, chosen by the data's nature — never mixed on one endpoint.

### 5.1 Cursor (keyset) — feeds, timelines, responses, notifications

`?cursor=<opaque>&limit=20` · default `limit` 20, max 50.

The cursor is **base64url of the sort key + id** of the last item served:

```
cursor = base64url(JSON.stringify({ "k": "2026-07-04T18:30:00.000Z",
                                    "id": "0198c9a1-7e2b-7cc3-9f1a-2b4d8e6f0a11" }))
```

executed as a keyset predicate:

```sql
WHERE (published_at, id) < ($k, $id)
ORDER BY published_at DESC, id DESC
LIMIT $limit + 1;   -- +1 row peek sets hasMore
```

**Why stable under insertion:** offset pagination addresses _positions_ — when new pieces
land at the top between two requests, positions shift and page 2 repeats or skips items.
A cursor addresses a _row_ ("everything after this piece"), so writers publishing at
full speed can't make a reader's feed stutter. It's also O(index seek) instead of
O(offset) — page 500 costs the same as page 1.

Cursor rules:

- **Opaque contract**: clients must not decode, construct, or persist cursors long-term.
  The encoding may change without notice; only round-tripping is guaranteed.
- Tied to its sort: a `trending` cursor uses `(trending_score, id)`, `latest` uses
  `(published_at, id)`. A cursor sent to a different tab/sort fails as `FEED_INVALID_CURSOR`.
- Undecodable/stale cursors → `400 FEED_INVALID_CURSOR`; the client restarts from the top.
- No totals — counting a feed is meaningless and violates the `COUNT(*)` ban.

`meta` shape:

```json
{ "pagination": { "limit": 20, "nextCursor": "eyJrIjoiMjAyNi0wNy0w…", "hasMore": true } }
```

`nextCursor` is `null` when `hasMore` is `false`.

### 5.2 Offset — admin tables only

`?page=1&limit=20` · default 20, max 100. Admin grids (users, reports, audit logs) need
jump-to-page and totals; their tables are moderate-sized and staff-only, so `COUNT(*)`
over a filtered, indexed query is acceptable here.

```json
{ "pagination": { "page": 3, "limit": 20, "totalItems": 1284, "totalPages": 65 } }
```

---

## 6. Filtering, sorting, search

| Concern        | Convention                                                                                 | Example                                       |
| -------------- | ------------------------------------------------------------------------------------------ | --------------------------------------------- |
| Filters        | flat query params named after the field                                                    | `?language=ur&genre=ghazal&tag=barish`        |
| Multi-value    | comma-separated, OR semantics                                                              | `?language=hi,ur`                             |
| Sort           | `?sort=` field name, `-` prefix = descending                                               | `?sort=-publishedAt`                          |
| Sort whitelist | each endpoint declares allowed sort fields in its DTO; anything else → `VALIDATION_FAILED` |                                               |
| Search         | `?q=` free text (websearch syntax supported)                                               | `/search?q="رات کی بارش" -نظم&type=pieces`    |
| Search scoping | `type=pieces\|writers\|tags` + the filter params above                                     | brief's axes: writer/title/tag/genre/language |
| Dates          | ISO 8601 UTC, inclusive bounds                                                             | `?from=2026-07-01&to=2026-07-31`              |
| Unknown params | rejected (`forbidNonWhitelisted: true`) — typos fail loudly, not silently                  |                                               |

Booleans in queries are literal `true`/`false` (transformed in DTOs). Enum-ish params
(`tab`, `type`, `status`) validate against `@qalam/shared` enums.

---

## 7. Authentication

Per ADR §3: JWT **access 15 min** + **rotating refresh 30 days**, Argon2id at rest,
Google OAuth (code + PKCE), refresh reuse-detection denylist in Redis DB 3.

| Concern       | Web (React apps)                                                           | Mobile (Flutter)                                         |
| ------------- | -------------------------------------------------------------------------- | -------------------------------------------------------- |
| Access token  | `Authorization: Bearer <jwt>` — held in memory only, never localStorage    | same header; token in secure storage                     |
| Refresh token | **httpOnly `Secure` `SameSite=Lax` cookie**, path-scoped to `/api/v1/auth` | returned in response **body**, kept in Keychain/Keystore |
| Refresh call  | `POST /auth/refresh` — cookie rides along                                  | `POST /auth/refresh` with `{ "refreshToken": "…" }`      |

Rotation: every refresh issues a new refresh token and invalidates the old one. Presenting
a consumed token is treated as theft → the whole token family is revoked
(`AUTH_REFRESH_REUSED`, 401) and the user must log in again.

Client refresh contract: on any `401` with `AUTH_TOKEN_EXPIRED`, attempt one silent
refresh and replay the request; on refresh failure, drop to login. All other 401 codes go
straight to login. 403 is never retried.

---

## 8. Rate limiting

Redis **sliding window** (DB 2), keyed per authenticated user id, else per IP. Every
rate-limited response — and every counted request — carries:

```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 17
X-RateLimit-Reset: 1783412220        # unix seconds when the window frees up
```

On breach: `429` + `Retry-After: <seconds>` + envelope code `RATE_LIMITED`.

| Tier                                            | Scope                | Limit           |
| ----------------------------------------------- | -------------------- | --------------- |
| `auth:login`                                    | per IP / per account | 5/min · 20/hour |
| `auth:register`                                 | per IP               | 3/hour          |
| `auth:forgot-password`                          | per IP + email       | 3/hour          |
| `auth:refresh`                                  | per user             | 60/hour         |
| `write` (POST/PATCH/DELETE on content)          | per user             | 60/min          |
| `engagement` (claps, likes, bookmarks, follows) | per user             | 120/min         |
| `search`                                        | per user / IP        | 60/min          |
| `read` (everything else)                        | per user / IP        | 600/min         |

Auth endpoints are deliberately the strictest tier — they're the credential-stuffing
surface. Limits are constants in `@qalam/shared` and enforced by a guard; tiers are
declared per-route with a decorator.

---

## 9. Idempotency & request tracing

### Idempotency-Key (Phase 1 scope: publish)

`POST /pieces/:id/publish` accepts an `Idempotency-Key` header (client-generated UUID).
Semantics:

- First request: processed; response stored in Redis for 24 h under the key.
- Retry with same key + same payload: **stored response replayed** (same status, body) —
  a flaky connection can never double-publish or double-fire notifications.
- Same key, different payload: `422 VALIDATION_IDEMPOTENCY_MISMATCH`.
- Same key while the first is still executing: `409` (conflict, retry after completion).

Clients generate one key per user intent (per tap of "Publish"), not per HTTP attempt.

### X-Request-Id

- Generated (UUIDv7) at the edge for every request, or honored if a trusted proxy sends one.
- Echoed on **every** response header, embedded in every error envelope (`requestId`),
  bound to the request-scoped Pino child logger, and propagated into BullMQ job payloads —
  one grep unites nginx log, API log, worker log, and Sentry event (ADR §9: frontend →
  API → queue jobs).

---

## 10. OpenAPI pipeline — the spec is the contract

```
@nestjs/swagger decorators (controllers + DTOs — required, lint-checked)
        │
        ▼
 SwaggerModule → /docs (Swagger UI, non-prod only; disabled in production)
        │
        ▼
 `pnpm --filter backend openapi:export` → openapi.json   (build artifact, CI-generated)
        │
        ├──▶ openapi-typescript ──▶ packages/api-types (@qalam/api-types) ──▶ web + admin
        │
        └──▶ openapi-generator (dart-dio) ──▶ Dart models/client ──▶ Flutter
```

Rules:

- Every route documents its success shape **and** its error codes
  (`@ApiOkResponse`/`@ApiErrorCodes(...)` custom decorator) — undocumented behavior is a
  review blocker, because for codegen consumers _undocumented = nonexistent_.
- `openapi.json` is exported in CI on every PR; the generated `@qalam/api-types` output is
  committed, and CI fails on drift — a backend change that alters the contract is visible
  in the same diff that causes it.
- Breaking-change review happens on the `openapi.json` diff, not on TypeScript goodwill.

---

## 11. Example endpoint contracts (intent, not implementation)

Canonical shapes for Phase 1's first endpoints. Field lists are illustrative minimums;
the OpenAPI spec is authoritative once generated.

### 11.1 `POST /api/v1/auth/register` → 201

```json
// request
{ "email": "meera@example.com", "password": "…", "username": "meera_k", "penName": "Meera" }

// response 201  (+ Set-Cookie: refresh token, httpOnly, for web clients)
{
  "success": true,
  "data": {
    "user": { "id": "0198…", "username": "meera_k", "penName": "Meera", "email": "meera@example.com" },
    "accessToken": "eyJhbGciOiJIUzI1NiIs…"
  }
}
```

Errors: `AUTH_EMAIL_TAKEN` 409 · `AUTH_USERNAME_TAKEN` 409 · `VALIDATION_FAILED` 400.
The username warning UX ("permanent, choose carefully") is a client concern; the API just
enforces it forever after.

### 11.2 `POST /api/v1/auth/login` → 200

```json
// request
{ "email": "meera@example.com", "password": "…" }

// response 200 (+ Set-Cookie refresh for web; mobile receives refreshToken in body)
{
  "success": true,
  "data": {
    "user": { "id": "0198…", "username": "meera_k", "penName": "Meera" },
    "accessToken": "eyJ…",
    "refreshToken": "only-present-for-mobile-clients"
  }
}
```

Errors: `AUTH_INVALID_CREDENTIALS` 401 (same code whether email or password was wrong —
no account enumeration) · `USER_SUSPENDED` 403 · `RATE_LIMITED` 429.

### 11.3 `POST /api/v1/auth/refresh` → 200

Web: empty body, cookie carries the token. Mobile: `{ "refreshToken": "…" }`.

```json
{ "success": true, "data": { "accessToken": "eyJ…", "refreshToken": "mobile-only" } }
```

Errors: `AUTH_TOKEN_INVALID` 401 · `AUTH_REFRESH_REUSED` 401 (family revoked).

### 11.4 `GET /api/v1/feed?tab=trending&limit=20&cursor=…` → 200

`tab` ∈ `following | trending | latest | discover` (required; the URL is the source of
truth for tabs, mirroring the frontend route contract).

```json
{
  "success": true,
  "data": [
    {
      "id": "0198c9a1-7e2b-7cc3-9f1a-2b4d8e6f0a11",
      "slug": "raat-ki-baarish",
      "title": "رات کی بارش",
      "subtitle": null,
      "featuredQuote": "بارش نے شہر کو دھو ڈالا",
      "coverImageUrl": "https://cdn.qalam.app/…",
      "language": { "code": "ur", "direction": "rtl" },
      "genre": { "slug": "nazm", "name": "Nazm" },
      "author": { "username": "meera_k", "penName": "Meera", "avatarUrl": "https://…" },
      "stats": { "likes": 214, "claps": 1580, "responses": 12 },
      "wordCount": 320,
      "readingTimeSeconds": 150,
      "publishedAt": "2026-07-04T18:30:00.000Z"
    }
  ],
  "meta": { "pagination": { "limit": 20, "nextCursor": "eyJrIjo…", "hasMore": true } }
}
```

Errors: `FEED_UNKNOWN_TAB` 400 · `FEED_INVALID_CURSOR` 400 · `AUTH_TOKEN_EXPIRED` 401
(the `following` tab requires auth; `trending`/`latest`/`discover` are public).

### 11.5 `GET /api/v1/pieces/:slug` → 200

Full piece for the reading surface (frontend route `/p/:slug`):

```json
{
  "success": true,
  "data": {
    "id": "0198c9a1-…",
    "slug": "raat-ki-baarish",
    "title": "رات کی بارش",
    "content": { "type": "doc", "content": [ { "type": "paragraph", "content": [ …TipTap… ] } ] },
    "language": { "code": "ur", "direction": "rtl" },
    "visibility": "public",
    "status": "published",
    "tags": [ { "slug": "barish", "name": "بارش" } ],
    "author": { "username": "meera_k", "penName": "Meera", "isFollowedByViewer": false },
    "stats": { "views": 4021, "likes": 214, "claps": 1580, "bookmarks": 77, "responses": 12 },
    "viewer": { "hasLiked": false, "clapCount": 0, "hasBookmarked": false },
    "publishedAt": "2026-07-04T18:30:00.000Z"
  }
}
```

`content` is the TipTap JSON — clients render it; the API never serves HTML (see
`04_DatabaseDesign.md` §5). Errors: `PIECE_NOT_FOUND` 404 (also for pieces the viewer
may not see — privacy-preserving).

### 11.6 `POST /api/v1/pieces` → 201 (creates a draft)

```json
// request
{
  "title": "रात की बारिश",
  "content": { "type": "doc", "content": [ … ] },
  "languageCode": "hi",
  "genreSlug": "nazm",
  "tags": ["baarish", "raat"],
  "visibility": "public"
}

// response 201
{
  "success": true,
  "data": { "id": "0198ca01-…", "status": "draft", "slug": null,
            "wordCount": 214, "readingTimeSeconds": 96,
            "createdAt": "2026-07-06T09:12:00.000Z" }
}
```

Publishing is the separate `POST /pieces/:id/publish` (with `Idempotency-Key`, §9),
optionally carrying `{ "scheduledAt": "…" }` → status `scheduled`; errors there include
`PIECE_SCHEDULE_IN_PAST` 422 and `PIECE_ALREADY_PUBLISHED` 409.

### 11.7 `POST /api/v1/pieces/:id/claps` → 200

```json
// request — claps accumulated client-side then flushed (press-and-hold UX)
{ "count": 5 }

// response 200
{ "success": true, "data": { "viewerClaps": 35, "totalClaps": 1585 } }
```

The server applies `min(requested, 50 - current)`; when the viewer is already at 50 the
request fails with `PIECE_CLAP_LIMIT` 422. Other errors: `PIECE_NOT_PUBLISHED` 409 ·
`RATE_LIMITED` 429.

---

## 12. Deprecation policy

- Nothing is removed within a major API version; removal requires `/api/v2`.
- A deprecated endpoint/field keeps working for **at least one minor version of overlap**
  after its replacement ships, and announces itself on every response:

```
Deprecation: true
Sunset: Sat, 31 Oct 2026 00:00:00 GMT          # RFC 8594
Link: </api/v1/pieces/raat-ki-baarish>; rel="successor-version"
```

- Deprecations are recorded in the OpenAPI spec (`deprecated: true`), the changelog, and
  surfaced to client teams the day they ship — not the week before sunset.
- Fields are deprecated the same way (spec annotation + changelog); a deprecated field
  keeps its value until sunset, never silently turns `null`.
