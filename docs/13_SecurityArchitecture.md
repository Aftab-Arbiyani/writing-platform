# 13 — Security Architecture

> **Derives from:** `00_ArchitectureDecisions.md` §3 (backend), §8 (security baseline),
> §10 (canonical reference). This document expands the baseline into a full design.
> Nothing here re-decides; it makes the baseline implementable and reviewable.
>
> **Scope:** application security for the Qalam platform — API, both React apps,
> BullMQ workers, media pipeline. Infrastructure hardening (TLS termination, firewalling,
> backups) lives in `15_DeploymentStrategy.md`.

---

## 1. Security Posture in One Paragraph

Qalam is a public social platform: most content is _meant_ to be read by strangers.
The crown jewels are the things that are **not** public — account credentials,
unpublished drafts, private-account content, the admin panel, and the original media
users upload. Our posture: **default-deny at every boundary** (validation, authZ,
CSP, CORS), **stateless access tokens with stateful revocation** (Redis), and
**every privileged mutation leaves an audit trail**. We prefer boring, verifiable
controls (parameterized queries, schema whitelists, allowlists) over clever ones.

## 2. Threat Model (STRIDE-lite)

We model per-asset rather than per-component — the asset list is short and stable.
Threat letters: **S**poofing, **T**ampering, **R**epudiation, **I**nfo disclosure,
**D**enial of service, **E**levation of privilege.

| Asset                       | Actor (threat agent)                | Threat                                                     | Mitigation                                                                                                                                                                      |
| --------------------------- | ----------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Accounts**                | Credential stuffer (botnet)         | **S** — login with breached passwords                      | Argon2id (§3.1), strict login rate limits (§8), generic error messages, no user-enumeration on login/register/reset                                                             |
| Accounts                    | Attacker with stolen refresh token  | **S/E** — long-lived session takeover                      | Rotating refresh tokens + family reuse detection (§3.2); "log out everywhere" (§3.6)                                                                                            |
| Accounts                    | Attacker on shared device           | **S** — session left behind                                | 15 min access TTL; per-device sessions listable and revocable                                                                                                                   |
| Accounts                    | Malicious OAuth `redirect_uri`      | **S** — code interception                                  | Exact-match registered redirect URIs, PKCE `S256`, `state` param (§3.4)                                                                                                         |
| **Unpublished drafts**      | Any authenticated user              | **I** — IDOR: fetch another writer's draft by id           | Ownership check in service layer on every draft read/write; drafts never appear in any list/search/feed query; UUIDv7 ids are non-enumerable but _never relied on_ as a control |
| Unpublished drafts          | Moderator/admin                     | **I** — casual browsing of drafts                          | Drafts are excluded from admin piece listings; access only via report context, and every such read is audit-logged (§11)                                                        |
| **Private-account content** | Stranger / logged-out user          | **I** — bypass follow gate via direct URL, search, or feed | Single `VisibilityService` policy (§4.2) applied in _every_ read path: piece fetch, profile, search results, feeds, embeds, sitemaps                                            |
| Private-account content     | Scraper                             | **I/D** — bulk harvesting                                  | Cursor pagination caps, per-IP rate limits, no batch "get all pieces by user" endpoint for non-followers                                                                        |
| **Admin panel**             | External attacker                   | **S/E** — reach admin surface                              | Separate origin `admin.qalam.example`, separate CORS entry, RBAC guard on every `/api/v1/admin/*` route, immediate session-version revocation (§3.6)                            |
| Admin panel                 | Rogue/compromised moderator         | **T/R/E** — silent abuse of power                          | Capability matrix (§4.1) — moderators cannot touch roles/templates/languages; audit log on every admin mutation with before/after diff (§11); super_admin actions alert         |
| Admin panel                 | XSS in user content viewed by admin | **E** — pivot from user content to admin session           | Server-side TipTap schema whitelist (§5.2), CSP without `unsafe-inline` scripts (§5.4), admin app renders user content through the same sanitizing renderer as the public app   |
| **Media storage**           | Uploader                            | **T** — upload malware / polyglot file disguised as image  | Pre-signed PUT with content-type + size conditions, magic-byte verification, unconditional `sharp` re-encode — original bytes never served (§7)                                 |
| Media storage               | Uploader                            | **I** — EXIF GPS leaks author's location                   | `sharp` re-encode strips all metadata by default (§7)                                                                                                                           |
| Media storage               | Any user                            | **D** — storage exhaustion                                 | Per-file caps, per-user daily upload quota, orphan-cleanup job for unconfirmed uploads                                                                                          |
| **API as a whole**          | Anyone                              | **D** — brute force, hot-endpoint hammering                | Redis sliding-window tiers (§8), pagination caps, statement timeouts in Postgres                                                                                                |
| API as a whole              | Insider / CI leak                   | **I** — secrets exposure                                   | Env-only secrets, `.env` git-ignored, CI secrets scoped per environment, rotation policy (§10)                                                                                  |

**Why STRIDE-lite:** a full STRIDE-per-element data-flow analysis is disproportionate
for a monolith with five sensitive assets. This table is re-reviewed whenever a new
module ships (checklist item in the module PR template).

---

## 3. Authentication

### 3.1 Password Storage — Argon2id

Library: `argon2` (node-argon2, native binding). Parameters (fixed in
`config/auth.config.ts`, values via env only if we ever need to tune):

| Parameter     | Value                                        | Why                                                                               |
| ------------- | -------------------------------------------- | --------------------------------------------------------------------------------- |
| Variant       | `argon2id`                                   | Hybrid: side-channel + GPU resistance; OWASP recommended                          |
| `memoryCost`  | 65536 (64 MiB)                               | Above OWASP minimum (19 MiB); ~40 ms on our target VM — acceptable at login rates |
| `timeCost`    | 3                                            | Library default; with 64 MiB memory this dominates GPU cost                       |
| `parallelism` | 4                                            | Matches vCPU budget; hashing runs on the libuv threadpool, not the event loop     |
| `hashLength`  | 32 bytes                                     |                                                                                   |
| Salt          | 16 bytes, per-hash, generated by the library | Never reused, never configured                                                    |

- Parameters are **encoded in the hash string** (PHC format), so raising them later
  is a lazy migration: verify with old params, re-hash with new params on successful login.
- Password policy: **length 10–128, no composition rules** (NIST 800-63B), checked
  against a local copy of a top-100k breached list at registration/change.
- Login compares against a dummy hash when the user doesn't exist → constant-time
  behavior, no user enumeration.

### 3.2 Token Architecture — Access + Rotating Refresh with Reuse Detection

Per ADR: **access JWT 15 min**, **refresh 30 days, rotating**. Both HS256 with
separate secrets (`JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET`). Asymmetric signing is
unnecessary while one monolith is the only verifier; revisit at worker extraction.

**Access token claims:** `sub` (user id), `role`, `sv` (session version, §3.6),
`iat`, `exp`, `jti`. **Nothing else** — no email, no username, no profile data.
Access tokens are verified statelessly on every request; Redis is _not_ consulted
on the hot path.

**Refresh tokens are stateful.** Every login creates a **token family** in Redis DB 3:

```
auth:family:{familyId}          → { userId, createdAt, device, ip, revoked: false }   TTL 30d
auth:rt:{jti}                   → { familyId, status: "live" | "used" }               TTL 30d
auth:user:{userId}:families     → SET of familyIds                                    TTL 30d (refreshed)
auth:user:{userId}:sv           → integer session version                             no TTL
```

**Rotation protocol** (`POST /api/v1/auth/refresh`):

```
client presents refresh token RT_n
  ├─ RT_n unknown/expired      → 401, no side effects
  ├─ RT_n status = "used"      → REUSE DETECTED:
  │      revoke entire family, bump nothing else, audit-log event
  │      auth.token.reuse_detected {userId, familyId, ip} → alert channel
  │      → 401 AUTH_SESSION_REVOKED (all holders of this family are out)
  └─ RT_n status = "live"      → mark RT_n "used", mint RT_n+1 in same family,
                                 mint fresh access token → 200
```

**Why families:** a stolen-then-replayed refresh token is indistinguishable from the
legitimate client until one of them refreshes twice. Family revocation guarantees the
attacker's win lasts at most one rotation, and the legitimate user is forced to
re-authenticate — loud failure over silent compromise.

### 3.3 Token Transport — Web vs Mobile

| Channel                     | Access token                                                                | Refresh token                                                    |
| --------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| **Web (frontend + admin)**  | JSON body → kept in memory only (Zustand session slice; never localStorage) | `httpOnly; Secure; SameSite=Lax` cookie, **`Path=/api/v1/auth`** |
| **Mobile (Flutter, later)** | JSON body → secure storage (Keychain / EncryptedSharedPreferences)          | JSON body → secure storage                                       |

- **Why cookie for web refresh:** XSS cannot exfiltrate an httpOnly cookie. The access
  token in memory is exposed to XSS in principle — but it lives ≤ 15 min and our XSS
  surface is aggressively minimized (§5). Refresh — the long-lived credential — is the
  one that must be XSS-proof.
- **Why `Path=/api/v1/auth`:** the refresh cookie is only ever sent to the three auth
  endpoints (`refresh`, `logout`, `logout-all`). Every other API request carries only
  the short-lived bearer token. This shrinks the CSRF surface to endpoints that are
  either harmless (logout) or safe by design (refresh returns tokens to the caller's
  JS, which a cross-site attacker can't read).
- Server distinguishes channels by explicit client type header (`X-Client: web|mobile`)
  set by our API clients, not by sniffing.

### 3.4 Google OAuth — Authorization Code + PKCE

Per ADR: Google at launch, **Apple deferred** (the flow below is provider-shaped so
Apple slots in as a second `auth_identities` provider with zero schema change).
We use code + PKCE even though we have a confidential backend — PKCE costs nothing
and protects the mobile client later.

```
 Browser (frontend)                 API (NestJS)                    Google
 ──────────────────                 ────────────                    ──────
 1. GET /api/v1/auth/google  ─────►
                                    generate state (CSRF nonce, Redis, 10 min TTL)
                                    generate code_verifier → S256 code_challenge
                             ◄───── 302 to accounts.google.com/o/oauth2/v2/auth
                                        ?client_id&redirect_uri&response_type=code
                                        &scope=openid email profile
                                        &state=...&code_challenge=...&code_challenge_method=S256
 2. user consents ────────────────────────────────────────────────►
 3. ◄────────────────────────────────────── 302 to /api/v1/auth/google/callback?code&state
 4. GET callback ────────────►
                                    verify state (single-use, delete from Redis)
                                    exchange code + code_verifier + client_secret ─►
                                                                   ◄─ id_token + tokens
                                    verify id_token (Google JWKS, iss, aud, exp)
                                    upsert auth_identities(provider='google', provider_uid=sub)
                                    mint access + refresh (new family)
                             ◄───── Set-Cookie (refresh) + 302 to app with one-time code
                                    → app exchanges one-time code for access token (JSON)
```

- `redirect_uri` is **exact-match registered**, one per environment. No wildcard,
  no open redirect: the post-login `returnTo` is validated against a path allowlist.
- We request the **minimum scopes** (`openid email profile`) and store only
  `provider_uid`, email, display name. Google access/refresh tokens are discarded —
  we never act on the user's behalf at Google.

### 3.5 Account Linking Rules

`users` 1—n `auth_identities` (`provider ∈ {password, google}`, unique
`(provider, provider_uid)`).

| Situation                                                            | Rule                                                                                                                                   |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Google sign-in, email matches existing **verified** password account | Auto-link identity to that account, notify by email ("Google sign-in was added")                                                       |
| Google sign-in, email matches existing **unverified** account        | **No auto-link** — sign-in creates nothing; user must verify email or reset password first. Prevents pre-registration account takeover |
| Add Google to logged-in account (settings)                           | Allowed; requires fresh session (< 5 min since auth)                                                                                   |
| Unlink an identity                                                   | Allowed only if ≥ 1 sign-in method remains; requires fresh session; audit event                                                        |
| Email change                                                         | Only via password identity + re-verification; never driven by OAuth profile drift                                                      |

### 3.6 Session Revocation — "Log Out Everywhere"

Three revocation levers, cheapest first:

1. **Single logout** — delete the presented refresh token's family; access token dies
   naturally within 15 min.
2. **Log out everywhere** — delete all families in `auth:user:{id}:families` and
   **increment `auth:user:{id}:sv`**. The `sv` claim baked into access tokens no longer
   matches → tokens are rejected on the next _stateful check_.
3. **Administrative kill** (admin disables account) — same as (2), plus account flag.

**Where `sv` is checked:** not on every request (that would make every request hit
Redis and defeat stateless access tokens). It is checked on: refresh, **all
`/api/v1/admin/*` routes**, and sensitive account routes (email/password change,
identity linking). Consequence, stated honestly: a revoked _ordinary_ session can
keep reading public content for ≤ 15 minutes; it can never reach admin or
account-mutation surfaces. This is our chosen trade — documented, not accidental.

---

## 4. Authorization

### 4.1 RBAC — Roles × Admin Capabilities

Ladder (strictly ordered, from ADR): `user < moderator < admin < super_admin`.
Roles live in `roles` / `user_roles`; the effective role is embedded in the access
token and re-verified against DB on admin routes (token role is a cache, DB is truth).

Capabilities map 1:1 to the admin route map (`/users`, `/pieces`, `/reports`,
`/card-templates`, `/prompts`, `/languages`, `/featured`, `/analytics`,
`/moderators`, `/roles`, `/audit-logs`):

| Capability                                         | moderator                                                                 | admin         | super_admin   |
| -------------------------------------------------- | ------------------------------------------------------------------------- | ------------- | ------------- |
| Users — view, warn, suspend                        | ✔                                                                         | ✔             | ✔             |
| Users — delete, restore, force logout              | ✖                                                                         | ✔             | ✔             |
| Pieces — view (incl. reported), unpublish, restore | ✔                                                                         | ✔             | ✔             |
| Pieces — hard delete                               | ✖                                                                         | ✔             | ✔             |
| Reports — triage, resolve, escalate                | ✔                                                                         | ✔             | ✔             |
| Card templates — CRUD                              | ✖                                                                         | ✔             | ✔             |
| Daily prompts — CRUD, schedule                     | ✖                                                                         | ✔             | ✔             |
| Languages — CRUD                                   | ✖                                                                         | ✔             | ✔             |
| Featured writers — curate                          | ✖                                                                         | ✔             | ✔             |
| Analytics — platform dashboards                    | ✖                                                                         | ✔             | ✔             |
| Moderators — invite, remove                        | ✖                                                                         | ✔             | ✔             |
| Roles — assign admin, edit role grants             | ✖                                                                         | ✖             | ✔             |
| Audit logs — read                                  | ✖                                                                         | ✔ (read-only) | ✔ (read-only) |
| Audit logs — write/delete                          | ✖ — append-only for **everyone**, enforced at DB (no UPDATE/DELETE grant) |               |               |

Invariants: nobody edits audit logs; only `super_admin` grants roles; no user can
change their own role; `super_admin` count is small and each grant fires an alert.

### 4.2 Content Visibility Matrix

Two independent axes (ADR §4 identity rules): **piece visibility**
(`public | unlisted | private`) and **account privacy** (public/private profile),
resolved against the **viewer relationship**. One policy function decides all reads:

```ts
// modules/pieces/visibility.service.ts — the ONLY place this logic exists
canView(viewer: Viewer, piece: Piece, author: Profile): Decision
```

| Piece visibility | Account | Owner | Follower              | Stranger / logged-out                             | Moderator+ (moderation context)                                    |
| ---------------- | ------- | ----- | --------------------- | ------------------------------------------------- | ------------------------------------------------------------------ |
| public           | public  | allow | allow                 | allow                                             | allow                                                              |
| public           | private | allow | allow                 | **deny** (profile teaser only: pen name + counts) | allow (audited)                                                    |
| unlisted         | public  | allow | allow via direct link | allow via direct link                             | allow (audited)                                                    |
| unlisted         | private | allow | allow via direct link | **deny**                                          | allow (audited)                                                    |
| private (draft)  | any     | allow | **deny**              | **deny**                                          | **deny** — except attached to an open report, then allow (audited) |

Enforcement rules (each one is a known historical bug-class we're closing up front):

- **Unlisted ≠ secret.** Unlisted pieces are excluded from feeds, search indexing
  queries, tag/genre pages, sitemaps, and profile piece lists — but the URL works.
  The FTS query and every feed query carry `visibility = 'public'` predicates; this is
  asserted by repository-level query scopes, not remembered by each caller.
- **Private accounts are enforced in the query layer** (ADR: no RLS). Repositories
  expose `visibleTo(viewer)` scopes; services are forbidden from hand-writing
  visibility predicates (lint rule bans `visibility =` string literals outside
  repositories).
- Aggregates leak too: like/bookmark lists, "responses to this piece", notification
  payloads, and OpenGraph embeds all route through `canView` before rendering.
- Moderator access is **contextual**: reachable only from a report or admin piece
  view, and each access writes an audit event (§11). Moderators have no "browse all
  private content" surface.

### 4.3 Guards + Decorators Pattern

Standard NestJS composition — declarative at the controller, decided in guards:

```
Request ─► JwtAuthGuard ─► RolesGuard ─► (route handler) ─► service-level ownership/visibility
            verifies JWT     @Roles()        @CurrentUser()     canView()/isOwner() — data-aware
            + sv on admin     metadata                            checks live HERE
```

```ts
@Controller("admin/prompts")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)                 // admin & super_admin pass; moderator/user 403
export class AdminPromptsController { … }

@Public()                          // explicit opt-OUT — default is authenticated
@Get("p/:slug")
getPiece(@Param("slug") slug: string, @CurrentUser() viewer: Viewer | null) { … }
```

- **Default-deny:** `JwtAuthGuard` is registered as a global `APP_GUARD`; anonymous
  access requires an explicit `@Public()` decorator. Forgetting a decorator locks a
  route down instead of opening it up.
- Guards answer _"may this role reach this route?"_. **Data-aware decisions**
  (ownership, visibility, follow state) live in services/`VisibilityService` — guards
  don't load entities.
- `RolesGuard` compares by ladder ordering (`admin` satisfies `@Roles(MODERATOR)`),
  so route annotations state the _minimum_ role.

---

## 5. Input & Output Security

### 5.1 Validation Boundaries

| Boundary                    | Mechanism                                                                                                            | Failure mode                                              |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Every HTTP body/query/param | `class-validator` DTOs via global `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })` | 400 `VALIDATION_FAILED` with field details                |
| Process environment         | Zod `env.schema.ts`                                                                                                  | **Boot refusal** — misconfigured pod never serves traffic |
| BullMQ job payloads         | Zod schema per queue at producer _and_ consumer                                                                      | Job → failed with non-retryable error                     |
| Webhooks/OAuth callbacks    | Signature/`state` verification before parsing                                                                        | 401, audit event                                          |

`whitelist + forbidNonWhitelisted` means **mass assignment is off by default** —
unknown fields are rejected, not silently dropped, so a client sending `"role": "admin"`
gets a 400 and we see it in logs.

### 5.2 TipTap Content — Server-Side Schema Whitelist

TipTap JSON is canonical (`content jsonb`, ADR §4). Client-side editor constraints are
UX, not security — **the server re-validates every document** against a whitelist
mirroring the editor spec (ADR: bold/italic/underline/align/blockquote/lists/footnotes/
mentions/hashtags):

| Allowed nodes                                                                                                                     | Allowed marks                 | Allowed attrs (per node/mark)                                                                                                                                               |
| --------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `doc`, `paragraph`, `text`, `heading (level 2–4)`, `blockquote`, `bulletList`, `orderedList`, `listItem`, `hardBreak`, `footnote` | `bold`, `italic`, `underline` | `paragraph.textAlign ∈ {left,right,center,justify}`; `footnote.id` (server-issued); `mention.userId` (must resolve to real user); `hashtag.tag` (must match tag slug regex) |

Sanitizer behavior (`modules/pieces/content-sanitizer.ts`, runs on every
create/update _before_ persistence):

1. Parse against the whitelist schema — **unknown node/mark types, unknown attributes,
   and any `style`/`class`/`href`-bearing structure are rejected (400), not stripped**.
   Rejection over stripping: silent stripping hides attacks and corrupts author intent.
2. Depth cap (32) and node-count cap (10 000) — parser DoS defense.
3. `mention.userId` re-resolved server-side (prevents fake-mention notification spam
   and mention-based enumeration).
4. Text content is extracted to `content_text` (FTS) from the _sanitized_ tree only.

**Why no `link` mark:** the editor spec doesn't include links in Phase 1, so the
whitelist doesn't either — the single most XSS-prone mark (`href="javascript:…"`)
simply cannot exist in stored content. When links ship, they arrive with protocol
allowlisting (`https`, `mailto`) and `rel="noopener nofollow ugc"`.

### 5.3 XSS Defense for Rendered Content

- Rendering is **JSON → React elements** through a fixed component map (one component
  per whitelisted node/mark). There is no `dangerouslySetInnerHTML` anywhere in either
  app — enforced by ESLint `react/no-danger: error`.
- Stored content is schema-valid JSON (§5.2), so even a bypassed renderer has no
  script-capable payload to emit.
- User-controlled _strings_ (titles, bios, pen names) are plain text rendered as React
  text nodes — escaped by construction.
- Defense in depth: CSP (§5.4) makes injected inline script inert even if both layers
  above fail.

### 5.4 Content-Security-Policy

Set by nginx for the two SPAs; helmet sets API headers. Frontend/admin policy
(one line, shown wrapped):

```
Content-Security-Policy:
  default-src 'none';
  script-src 'self';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https://media.qalam.example;
  font-src 'self';
  connect-src 'self' https://api.qalam.example https://o0.ingest.sentry.io;
  form-action 'self';
  frame-ancestors 'none';
  base-uri 'none';
  object-src 'none';
  upgrade-insecure-requests
```

- `script-src 'self'` with **no `unsafe-inline`, no `unsafe-eval`** — Vite emits
  external module bundles, so this is achievable day one and non-negotiable.
- `style-src 'unsafe-inline'` is a concession to AntD's runtime style injection
  (cssinjs). Accepted: style-based exfiltration is a far weaker primitive than script,
  and AntD 5 has no nonce-free alternative. Revisit if AntD adds CSP nonce support
  to our satisfaction.
- `img-src` allowlists the media domain only (§7); no wildcard `https:`.
- API responses get `default-src 'none'; frame-ancestors 'none'` — a JSON API needs
  no CSP allowances at all.

Companion headers (helmet on API, nginx on static):
`Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` ·
`X-Content-Type-Options: nosniff` · `Referrer-Policy: strict-origin-when-cross-origin` ·
`X-Frame-Options: DENY` (legacy mirror of frame-ancestors) ·
`Permissions-Policy: camera=(), microphone=(), geolocation=()`.

### 5.5 CSRF Posture

CSRF requires a credential the browser attaches automatically. Our model minimizes
that class to near-zero, then constrains what remains:

| Surface                                             | Credential                                    | CSRF exposure                                       |
| --------------------------------------------------- | --------------------------------------------- | --------------------------------------------------- |
| All state-changing API routes                       | `Authorization: Bearer` header, set by our JS | **None** — browsers never attach headers cross-site |
| `POST /api/v1/auth/refresh`, `logout`, `logout-all` | httpOnly cookie, `Path=/api/v1/auth`          | Residual — see below                                |

Residual analysis: `SameSite=Lax` blocks the cookie on all cross-site `POST`s; all
three endpoints are `POST`-only, so top-level GET navigation (the Lax carve-out) can't
reach them. Belt-and-suspenders: the API validates the `Origin` header against the
CORS allowlist on every cookie-bearing request and rejects mismatches with 403.
Even a theoretical forced-refresh returns tokens in a response body the attacker
cannot read (CORS), and forced-logout is an annoyance, not a compromise. **Therefore:
no CSRF token machinery** — it would defend endpoints that are already unreachable
or unprofitable cross-site. Documented so nobody "adds CSRF protection" ad hoc later.

### 5.6 CORS Allowlist

`@nestjs/platform-express` CORS with an **exact-origin allowlist from env** — never
`*`, never reflected origins:

| Env        | Allowed origins                                                            |
| ---------- | -------------------------------------------------------------------------- |
| local      | `http://localhost:5173`, `http://localhost:5174`                           |
| staging    | `https://app.staging.qalam.example`, `https://admin.staging.qalam.example` |
| production | `https://app.qalam.example`, `https://admin.qalam.example`                 |

`credentials: true` (refresh cookie), `maxAge: 600` on preflight, allowed headers
limited to `Authorization, Content-Type, X-Request-Id, X-Client, Idempotency-Key`.

---

## 6. Injection Defense

- **SQL:** TypeORM parameter binding **only**. Query builders use `:param` bindings;
  raw SQL is allowed solely in repositories via `dataSource.query(sql, params)` with a
  static SQL string. **String interpolation into SQL is banned** — enforced by review
  checklist and an ESLint rule flagging template literals passed to
  `query`/`createQueryBuilder` `where` positions.
- **FTS input** (ADR: `simple` config + `unaccent` + `pg_trgm`): user search text is
  never spliced into `to_tsquery`. We use
  `websearch_to_tsquery('simple', unaccent($1))` — it tolerates arbitrary user input
  (quotes, `OR`, dangling operators) without syntax errors, and the text itself is a
  bound parameter. Pre-normalization: strip control characters, collapse whitespace,
  cap at 256 chars. The `pg_trgm` fallback path uses `similarity(column, $1)` —
  also fully parameterized.
- **Redis:** commands via ioredis method API (no `EVAL` of user-derived scripts);
  key components are validated ids, never raw user text.
- **Command injection:** no `child_process` with user input anywhere; image work goes
  through `sharp`'s library API (libvips), not CLI tools.
- **Path traversal:** storage object keys are server-generated
  (`covers/{uuid}.webp`) — user-supplied filenames are stored as display metadata
  only, never used in keys or paths.

---

## 7. Media Upload Security

ADR: pre-signed URLs, API never proxies file bytes; `sharp` in the
`media-processing` worker; MinIO dev / S3-R2 prod, bucket `qalam-media`.

```
 Client                    API                          Object storage           media-processing worker
 ──────                    ───                          ──────────────           ───────────────────────
 1. POST /media/uploads ─► validate kind, declared
    {kind, contentType,     contentType ∈ allowlist,
     sizeBytes}             size ≤ cap, user quota
                       ◄─── pre-signed PUT (5 min TTL)
                            key: quarantine/{uuid}
                            conditions: exact Content-Type,
                            Content-Length ≤ cap
 2. PUT bytes ────────────────────────────────────────►
 3. POST /media/uploads/{id}/complete ─►
                            enqueue media-processing ───────────────────────────► 4. stream head → magic-byte
                                                                                     check (file-type pkg);
                                                                                     mismatch → delete + fail
                                                                                  5. sharp re-encode → WebP
                                                                                     (+ JPEG fallback), resize
                                                                                     variants, METADATA STRIPPED
                                                                                  6. write public/{uuid}-{variant}.webp
                                                                                     delete quarantine object
                                                                                  7. mark media row "ready"
```

| Control              | Value                                                                                                                           |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Accepted input types | `image/jpeg`, `image/png`, `image/webp` (Phase 1 — covers + avatars only)                                                       |
| Size caps            | avatar 5 MB · cover 10 MB (also enforced by pre-signed `Content-Length` condition and nginx `client_max_body_size`)             |
| Pixel caps           | 12 000 × 12 000 decode limit (`sharp` `limitInputPixels`) — decompression-bomb defense                                          |
| Re-encode            | **Unconditional**, even if input is already WebP. Output pixels only — EXIF/GPS/ICC/XMP and any polyglot payload do not survive |
| Quarantine           | Unprocessed objects live under `quarantine/` (never publicly readable); orphans deleted after 24 h by cleanup job               |
| User quota           | 100 uploads/day                                                                                                                 |

**Separate media domain** (`media.qalam.example` → CDN → bucket): user-supplied bytes
are never served from an origin that carries our cookies or runs our scripts. Even a
hypothetical content-sniffing or SVG-smuggling bug lands in a cookie-less,
CSP-sandboxed (`Content-Security-Policy: sandbox`, `X-Content-Type-Options: nosniff`)
origin with nothing to steal.

---

## 8. Rate Limiting

Redis **sliding-window** counters (sorted-set algorithm) in **Redis DB 2** (ADR map),
keyed per user id when authenticated, per IP otherwise. Responses carry
`X-RateLimit-Limit / -Remaining / -Reset`; exceeding returns 429
`RATE_LIMITED` with `Retry-After`.

| Tier          | Endpoints                                      | Limit                                                | Key                | Why this number                                                     |
| ------------- | ---------------------------------------------- | ---------------------------------------------------- | ------------------ | ------------------------------------------------------------------- |
| auth-critical | `POST /auth/login`                             | 5 / min + 20 / hour                                  | IP **and** account | Blunt credential stuffing without locking out fat-fingered users    |
| auth-critical | `POST /auth/register`                          | 3 / hour                                             | IP                 | Bot signups                                                         |
| auth-critical | `POST /auth/forgot-password`, `reset-password` | 3 / hour                                             | IP + account       | Reset-spam, token brute force                                       |
| auth-flow     | `POST /auth/refresh`                           | 30 / hour                                            | family             | Legit clients refresh ≈ 4/hour; 30 tolerates clock-skewed retries   |
| write         | publish, draft save, response, repost/quote    | 30 / min                                             | user               | Autosave-friendly; blocks flood-publishing                          |
| social        | like, clap, bookmark, follow                   | 60 / min                                             | user               | Claps batch client-side; 60 covers enthusiastic readers, kills bots |
| search        | `GET /search`                                  | 30 / min                                             | user / IP          | FTS is our most expensive read                                      |
| media         | upload ticket requests                         | 20 / hour                                            | user               | Pairs with §7 quota                                                 |
| admin         | all `/admin/*` mutations                       | 120 / min                                            | user               | High — admins bulk-triage; audit log is the real control here       |
| default       | everything else                                | 300 / min authenticated · 100 / min per IP anonymous | user / IP          | Ceiling against runaway clients                                     |

**Why sliding window over fixed window:** fixed windows admit 2× bursts at boundaries;
the sorted-set sliding window is exact, and at our request volume the extra Redis cost
is irrelevant. Limits live in `@qalam/shared` next to the other domain limits.

---

## 9. OWASP Top 10 (2021) Mapping

| #   | Category                                 | Our mitigations (primary → backstop)                                                                                                                                                                                                          |
| --- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A01 | Broken Access Control                    | Global default-deny guard + `@Public()` opt-out (§4.3); single `VisibilityService` (§4.2); repository visibility scopes; service-layer ownership checks; admin capability matrix (§4.1)                                                       |
| A02 | Cryptographic Failures                   | Argon2id (§3.1); TLS everywhere (HSTS preload); JWT secrets ≥ 256-bit random, separate per token type; no PII in JWT claims; UUIDv7 not used as a secret                                                                                      |
| A03 | Injection                                | Parameterized TypeORM only + lint ban on interpolation (§6); `websearch_to_tsquery`; DTO whitelist validation (§5.1); TipTap schema rejection (§5.2)                                                                                          |
| A04 | Insecure Design                          | This document's threat model (§2), re-reviewed per module; abuse-case rows in every feature design doc; limits catalogued in `@qalam/shared`                                                                                                  |
| A05 | Security Misconfiguration                | Zod env fail-fast at boot; helmet + CSP (§5.4); Swagger `/docs` disabled in prod (ADR §3); non-root distroless/alpine containers; `synchronize: false` always                                                                                 |
| A06 | Vulnerable & Outdated Components         | `pnpm-lock.yaml` committed; `pnpm audit --prod` gate in CI; Renovate scheduled post-launch (§12); pinned major versions per ADR §10                                                                                                           |
| A07 | Identification & Authentication Failures | Rate-limit tiers (§8); rotation + family reuse detection (§3.2); breached-password check; no enumeration; fresh-session requirement on sensitive ops (§3.5)                                                                                   |
| A08 | Software & Data Integrity Failures       | Lockfile-only installs (`--frozen-lockfile`); GitHub Actions pinned to commit SHAs; images tagged by git SHA (doc 15); no runtime plugin loading; BullMQ payloads Zod-validated at consumer                                                   |
| A09 | Security Logging & Monitoring Failures   | Audit log on every admin mutation (§11); auth event taxonomy + reuse-detection alerts (doc 14); Sentry with scrubbing (§13); alerting table in doc 14 §8                                                                                      |
| A10 | SSRF                                     | Phase 1 has **no user-supplied URL fetching** (no link previews, no import-by-URL); outbound calls limited to Google OAuth + Sentry + S3, all env-configured hosts. When URL features ship: DNS-pinned allowlist fetcher, private-range block |

## 10. Secrets Management

- **Env only** (ADR §8): all secrets enter via the environment variables catalogued in
  ADR §10. `.env` is git-ignored; `.env.example` documents shape with placeholder
  values; a repo-wide secret scanner (gitleaks) runs in CI as a tripwire.
- Distinct values **per environment** — staging never shares a secret with production,
  so a staging leak is contained.
- Storage: local `.env` → developer machine; staging/production → GitHub Environments
  secrets injected at deploy (doc 15). No secrets in images, compose files, or logs
  (Pino redaction, §13).
- **Rotation policy:**

| Secret                                     | Cadence                      | Method                                                                                     |
| ------------------------------------------ | ---------------------------- | ------------------------------------------------------------------------------------------ |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | 6-monthly + on suspicion     | Dual-secret verification window (accept old for 15 min / 30 d respectively, sign with new) |
| `S3_SECRET_KEY`, DB password, `SMTP_URL`   | Yearly + on personnel change | Create-new → cut over → revoke-old                                                         |
| `GOOGLE_CLIENT_SECRET`                     | On suspicion                 | Google console supports two active secrets — same overlap pattern                          |
| Any secret in an incident                  | Immediately                  | Runbook §14                                                                                |

## 11. Audit Logging

Every admin mutation writes to `audit_logs` (append-only — the DB role used by the
app has no UPDATE/DELETE grant on this table):

```jsonc
{
  "id": "uuidv7",
  "actorId": "…",
  "actorRole": "admin",
  "action": "piece.unpublish", // dot taxonomy, matches log events (doc 14)
  "targetType": "piece",
  "targetId": "…",
  "before": { "status": "published" }, // changed fields only
  "after": { "status": "unpublished", "reason": "REPORT_UPHELD" },
  "ip": "203.0.113.7",
  "userAgent": "…",
  "requestId": "…",
  "createdAt": "…",
}
```

Also audited (not only mutations): moderator access to private/draft content (§4.2),
role grants, refresh-reuse detections, and login events on admin accounts.
Written **transactionally with the mutation** — an admin action that fails to audit
fails entirely. Retention: 7 years (doc 14 §9). Surfaced read-only at `/audit-logs`
in the admin panel with actor/action/target filters.

## 12. Dependency & Supply-Chain Policy

- `pnpm-lock.yaml` is authoritative; CI installs with `--frozen-lockfile` — an
  unreviewed transitive bump cannot enter a build.
- **CI gate:** `pnpm audit --prod --audit-level high` fails the pipeline; dev-dep
  advisories warn but don't block (they don't ship).
- pnpm's strict node_modules (ADR §2) doubles as a supply-chain control: phantom
  dependencies can't be reached, and `onlyBuiltDependencies` allowlists install
  scripts (`argon2`, `sharp` — nothing else runs postinstall).
- **Renovate later** (post-launch): weekly grouped PRs, auto-merge patch-level for
  dev-deps only; runtime deps always human-reviewed.
- New runtime dependency = PR-reviewed decision: maintenance signal, install scripts,
  transitive weight.

## 13. Telemetry Scrubbing — Sentry + Pino

Full logging design in `14_LoggingMonitoring.md`; the security-relevant contract:

- **Pino `redact` paths (baseline list):**
  `req.headers.authorization`, `req.headers.cookie`, `res.headers["set-cookie"]`,
  `*.password`, `*.currentPassword`, `*.newPassword`, `*.token`, `*.refreshToken`,
  `*.accessToken`, `*.code` (OAuth), `*.email` → partial-mask serializer
  (`af***@s***.com`).
- **Sentry:** `sendDefaultPii: false`; `beforeSend` strips request bodies on auth
  routes, cookies and auth headers everywhere; user context is **`{ id }` only** —
  never email or username.
- Token values never appear in URLs (no `?token=` patterns; reset links carry
  single-use opaque ids that are themselves redacted by path pattern).

## 14. Incident Response Basics

**Severity levels:**

| Sev  | Definition                                    | Examples                                               | Response                    |
| ---- | --------------------------------------------- | ------------------------------------------------------ | --------------------------- |
| SEV1 | Active compromise or data breach              | Credential dump, refresh-token forgery, admin takeover | Page on-call now; all-hands |
| SEV2 | Exploitable vulnerability, no confirmed abuse | Auth bypass found, injection reachable                 | Same-day fix or mitigation  |
| SEV3 | Hardening gap / suspicious signal             | Reuse-detection spike, audit anomaly                   | Triage within 48 h          |
| SEV4 | Policy/process deviation                      | Secret committed to a branch (caught by scanner)       | Rotate + fix in normal flow |

**First 30 minutes (SEV1/SEV2):**

1. **Declare & timestamp** — name an incident lead; open a dedicated channel; start a
   timeline doc (facts + times, no speculation).
2. **Contain** — depending on vector: revoke affected token families / bump session
   versions (`logout-all` at user or global scope); disable compromised admin
   accounts; block abusive IPs at nginx; if storage keys leaked, rotate S3 keys.
3. **Preserve** — snapshot logs and audit rows for the window; do **not** restart
   services that hold volatile evidence unless containment demands it.
4. **Assess blast radius** — audit logs + auth events: which accounts, which data,
   since when.
5. **Rotate** any secret plausibly involved (§10 table, "immediately" row).
6. **Communicate** — internal status at 30 min; user/regulatory notification decision
   made by lead once scope is known (never speculatively).

Post-incident: blameless review within 5 working days; every action item lands as a
tracked issue; this document is updated if the model missed the vector.

---

_Cross-references: logging/alerting → `14_LoggingMonitoring.md` · TLS, nginx headers,
backups, deploy gates → `15_DeploymentStrategy.md` · ERD for `auth_identities`,
`roles`, `audit_logs` → `04_DatabaseDesign.md`._
