# 09 — User Flows

> **Derives from:** `00_ArchitectureDecisions.md` §3 (auth), §4 (identity rules, counters),
> §5 (API envelope, error codes, pagination, idempotency), §6 (frontend stack), §10
> (route map, product decisions). Routes referenced here are the canonical §10 routes.
> State-layer mechanics (query keys, optimistic updates) are specified in
> `12_StateManagement.md`; this document specifies **user-visible behavior**.

**Flow index**

| #   | Flow                                | Primary actor | #   | Flow                        | Primary actor    |
| --- | ----------------------------------- | ------------- | --- | --------------------------- | ---------------- |
| 1   | Sign up (email + password)          | Visitor       | 9   | Collections & reading lists | User             |
| 2   | Google OAuth sign-in                | Visitor       | 10  | Follow · private accounts   | User             |
| 3   | Login + refresh rotation            | User          | 11  | Repost / Quote / Response   | User             |
| 4   | Forgot / reset password             | Visitor       | 12  | Mentions                    | Writer           |
| 5   | Write → autosave → publish          | Writer        | 13  | Search & discovery          | Visitor/User     |
| 6   | Scheduled publish                   | Writer        | 14  | In-app notifications        | User             |
| 7   | Read a piece (view/read/completion) | Visitor/User  | 15  | Report → moderation         | User + Moderator |
| 8   | Clap / Like / Bookmark              | User          | 16  | Writer analytics            | Writer           |

**Conventions used below**

| Term             | Meaning                                                                                                                                  |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Actor            | `Visitor` (no session) · `User` · `Writer` (User acting as author) · `Moderator` / `Admin` (RBAC §8)                                     |
| Error codes      | `DOMAIN_REASON` catalogue in `@qalam/shared`; always delivered in the §5 error envelope                                                  |
| "Session issued" | Access JWT (15 min) held in memory + rotating refresh JWT (30 d) set as httpOnly `Secure` `SameSite=Lax` cookie scoped to `/api/v1/auth` |
| Queue            | Named BullMQ queue from ADR §3 (`scheduled-publish`, `notifications`, `analytics-rollup`, `emails`, …)                                   |

---

## 1. Sign up (email + password, username, pen name)

**Preconditions:** Visitor; email not registered.
**Route:** `/auth/register` — a 3-step client-side wizard; **one atomic** `POST /api/v1/auth/register` at the end. _Why:_ no half-created accounts, no orphaned usernames reserved by abandoned wizards.

```
 Step 1: Account          Step 2: Username              Step 3: Pen name
┌──────────────────┐     ┌───────────────────────┐     ┌────────────────────┐
│ email            │     │ @ [_meer_taqi______]  │     │ pen name           │
│ password         │ ──▶ │ ✓ available           │ ──▶ │ (changeable later) │──▶ POST /auth/register
│ [Continue with   │     │ ⚠ PERMANENT — this is │     │ preferred writing  │    (single atomic call)
│  Google] (Flow 2)│     │   your URL forever    │     │ language (optional)│
└──────────────────┘     │ ☑ I understand        │     └────────────────────┘
                         └───────────────────────┘
```

1. **Step 1 — Account.** Email + password (Zod: valid email; ≥ 8 chars). Inline validation via RHF.
2. **Step 2 — Username.** Input constrained to `^[a-z0-9_]{3,30}$` (`USERNAME_REGEX` from `@qalam/shared`). Debounced (400 ms) availability check: `GET /api/v1/users/username-availability?u=…`.
3. **PERMANENT-username warning.** Directly under the field, always visible — not a tooltip:
   > "Your username is **permanent**. It becomes your profile URL (`qalam.app/@username`) and can never be changed. Your pen name _can_ change anytime."
   > The **Continue** button is disabled until the user checks _"I understand my username is permanent."_
4. **Step 3 — Pen name.** Free text, defaults to the username; explicitly labeled "changeable later in Settings → Profile". Optional preferred writing language picker (seeds feed defaults).
5. Submit → `POST /api/v1/auth/register { email, password, username, penName, … }`. Server: Argon2id-hash password, create `users` + `profiles` + `auth_identities(provider='email')` in one transaction; enqueue verification email on `emails` queue (**non-blocking** — account is usable immediately, a dismissible banner shows until verified).
6. Session issued → redirect to `/feed?tab=discover` (first-run) with a one-time "welcome" toast.

**Postconditions:** User exists with permanent `username`, changeable `pen_name`; logged in; verification email queued.

**Edge / error branches**

| Branch                                         | Behavior                                                                                  |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Email already registered                       | `AUTH_EMAIL_IN_USE` → inline error with links to `/auth/login` and "Continue with Google" |
| Username taken (live check)                    | Field error + up to 3 server-suggested variants                                           |
| Username race (taken between check and submit) | 409 `USER_USERNAME_TAKEN` → wizard returns to Step 2, other input preserved               |
| Rate limited                                   | 429 with `X-RateLimit-*`; form disabled with countdown                                    |

---

## 2. Google OAuth sign-in (new vs existing account)

**Preconditions:** Visitor on `/auth/login` or `/auth/register`. Authorization-code + PKCE (ADR §3).

```
Browser                          Google                     Qalam API
   │ click "Continue with Google"  │                            │
   ├── redirect (client_id, state, │                            │
   │   code_challenge) ───────────▶│                            │
   │◀── redirect back with ?code ──┤                            │
   │  /auth/google/callback (SPA route, spinner)                │
   ├── POST /api/v1/auth/google { code, codeVerifier } ────────▶│
   │                               │◀── exchange code, verify ──┤
   │                               │    id_token, email         │
   │◀──────── one of three outcomes (below) ────────────────────┤
```

**Outcome A — existing Google identity.** `auth_identities(provider='google')` matches → session issued → redirect to return-to or `/feed`.

**Outcome B — existing email/password account, same verified Google email.** Auto-link: create the `google` identity on that user, issue session, show toast _"Google connected to your account."_ _Why auto-link:_ Google asserts a verified email; forcing a manual merge punishes the common case. If Google reports the email **unverified** → `AUTH_OAUTH_EMAIL_UNVERIFIED`: no auto-link; user is told to log in with password and link Google in `/settings/account`.

**Outcome C — no account.** API responds `data: { onboarding: { token } }` (short-lived signed token, 15 min). Client routes to `/auth/register?provider=google` showing **only wizard steps 2–3** (username + PERMANENT warning; pen name pre-filled from the Google display name). Submit → `POST /api/v1/auth/register/google { onboardingToken, username, penName }` → account created (no password; email pre-verified) → session issued.

**Edge branches:** `state` mismatch / expired PKCE → `AUTH_OAUTH_STATE_MISMATCH`, restart flow. User cancels on Google consent → returned to login, no error toast (intentional abandonment is not an error). Onboarding token expiry → restart from the Google button.

---

## 3. Login + refresh rotation (user-visible behavior)

**Preconditions:** Registered user; Visitor session.

1. `/auth/login` → email/username + password → `POST /api/v1/auth/login`.
2. Success → session issued → redirect to `?returnTo=` if present (see guard spec, `11_RoutingArchitecture.md`) else `/feed`.
3. **Silent refresh — invisible by design.** The 15-minute access token never surfaces to the user:
   - On app boot, the client calls `POST /api/v1/auth/refresh` (cookie-authenticated) before rendering authed UI; success hydrates `qk.auth.me`.
   - Mid-session, any 401 triggers the interceptor: refresh → retry the original request **once** (`12_StateManagement.md` §7). The user sees at most a ~200 ms delay.
   - Each refresh **rotates** the refresh token (new 30-day cookie). A user active at least once a month is therefore _never_ logged out.
4. **Reuse detection (Redis DB 3 denylist).** If a rotated (already-used) refresh token is replayed — a token-theft signal — **all** of that user's refresh tokens are revoked. User-visible result: every device is bounced to `/auth/login?reason=security` showing _"You were signed out everywhere for your security. Please log in again."_

**Edge branches:** bad credentials → `AUTH_INVALID_CREDENTIALS` (never reveals which field was wrong). OAuth-only account tries password login → `AUTH_PASSWORD_NOT_SET` with a "use Google or set a password via reset" hint. Strict per-IP + per-identifier rate limits (ADR §5).

**Postconditions:** Valid session; rolling 30-day persistence while active.

---

## 4. Forgot / reset password

**Preconditions:** Visitor (or logged-out user); email form at `/auth/forgot-password`.

```
Browser                      API                    emails queue          Mailbox
   │ POST forgot-password ──▶ │ 200 always            │                     │
   │◀── "if registered…" ─────┤ token (30 min, single │                     │
   │                          │ use) ────────────────▶│── SMTP (Mailpit) ──▶│
   │◀────────────── user clicks /auth/reset-password?token=… ───────────────┤
   │ POST reset-password ────▶│ re-hash, revoke ALL refresh tokens          │
   │◀── success → /auth/login ┤                                             │
```

1. `/auth/forgot-password` → email → `POST /api/v1/auth/forgot-password`.
2. API responds **200 regardless of whether the email exists** (_Why:_ no account enumeration). UI: "If that email is registered, a reset link is on its way."
3. If the account exists: single-use token (TTL 30 min) generated; email enqueued on `emails` (Mailpit in dev).
4. Link → `/auth/reset-password?token=…` → new password (same Zod policy as signup) → `POST /api/v1/auth/reset-password { token, password }`.
5. Success: password re-hashed (Argon2id); **all refresh tokens revoked** (every device logged out); token consumed. UI confirms → `/auth/login`.

**Postconditions:** New password active; every existing session terminated; the reset token unusable.

**Edge branches:** expired/consumed token → `AUTH_RESET_TOKEN_INVALID` with a "request a new link" CTA. Repeated requests rate-limited; only the newest token stays valid. OAuth-only account requesting reset → the email offers "set a password" (same token flow) — this is also how Google-only users add password login.

---

## 5. Write → autosave draft → preview → publish

**Preconditions:** Authenticated user. **Routes:** `/write` (new) → `/write/:draftId`.

```
 Writer            Editor (TipTap)          API                       DB
   │ types…             │                    │
   │                    │  first change ──▶ POST /api/v1/pieces (draft)│
   │                    │  URL ⇒ /write/:draftId (history.replace)     │
   │ types…             │  debounce 2 s ──▶ PATCH /pieces/:id ────────▶│ content jsonb,
   │   "Saving…/Saved"  │◀── 200 ───────────┤                          │ content_text,
   │                    │                    │                         │ word_count
   │ Preview toggle     │  render same JSON through the reader renderer│
   │ Publish sheet ───▶ POST /pieces/:id/publish  (Idempotency-Key) ──▶│ status=published
```

1. Opening `/write` creates **nothing**. The draft row is created lazily on the **first content change**; the URL is replaced with `/write/:draftId`. _Why:_ no empty-draft litter from tire-kickers.
2. **Autosave:** debounced 2 s after last keystroke; `PATCH` sends TipTap JSON (canonical, ADR §4). Server derives `content_text`, `word_count`, `reading_time_seconds` on write. Status chip cycles `Saved → Saving… → Saved` (offline/error states in `12_StateManagement.md` §5).
3. **Preview** is an in-editor mode toggle rendering the same TipTap JSON through the reader's renderer — same fonts, same `dir` (Urdu previews RTL in Nastaliq). No server round-trip.
4. **Publish sheet** collects the ADR-locked metadata: title (required), subtitle, cover image (pre-signed upload → `media-processing` worker), featured quote, tags (≤ 5, folksonomy), genre (exactly 1, curated), **language (exactly 1** — ADR: one language per piece; drives `dir` and reading typeface), visibility (`public | unlisted | private`), and _Publish now_ vs _Schedule_ (Flow 6).
5. `POST /api/v1/pieces/:id/publish` carries an `Idempotency-Key` (ADR §5 — publish is the Phase-1 idempotent endpoint; a retried double-click cannot double-publish). Server: validates metadata, **freezes the slug** (`10_InformationArchitecture.md` §5), sets `status=published`, `published_at=now()`, extracts mentions (Flow 12).
6. Redirect to the live piece at `/p/:slug` with a "Published" toast + share affordances.

**Postconditions:** Piece live in Latest/Following feeds; `piece_stats` row initialized. **No** "new piece" notification is sent to followers — the Following feed is that surface (the ADR notification set is deliberately small).

**Edge branches:** missing title/genre/language → sheet field errors, nothing sent. Concurrent edit from a second tab → `updated_at` precondition fails, 409 `PIECE_STALE_WRITE`, banner "This draft changed in another tab — reload". Unpublish returns the piece to `draft`; the slug stays reserved.

---

## 6. Scheduled publish (BullMQ, user timezone)

**Preconditions:** Draft passing publish validation; user chose _Schedule_.

1. Datetime picker operates in the **user's local timezone** and says so explicitly ("6 Jul 2026, 21:00 — Asia/Kolkata"). The client submits an ISO-8601 UTC instant; `scheduled_at` is stored UTC (`timestamptz`). _Why:_ one unambiguous instant; every reader sees it localized.
2. `POST /pieces/:id/publish { scheduledAt }` → server validates future instant, sets `status=scheduled`, and enqueues a **delayed job** on `scheduled-publish` with `jobId = piece.id` (natural dedup: rescheduling replaces, never duplicates).
3. At `scheduled_at`, the worker re-validates (still `scheduled`? author not suspended?) → flips to `published`, sets `published_at`, runs mention extraction — identical postconditions to Flow 5.
4. Writer-visible: badge "Scheduled · 6 Jul, 21:00" in `/me/drafts` with _Edit_, _Reschedule_, _Cancel_ (→ back to `draft`, delayed job removed).

**Edge branches:** past instant → 422 `PIECE_SCHEDULE_IN_PAST` (client blocks first; server is authoritative). Worker down at the instant → BullMQ delayed jobs fire on recovery: published **late, never lost**. Piece deleted while scheduled → worker no-ops.

---

## 7. Read a piece — views vs reads vs completions

**Preconditions:** Piece is `published` and visible to the actor (visibility guards, ADR §4). **Route:** `/p/:slug`.

Three strictly-ordered metrics (each implies the previous), powering Flow 16:

| Metric         | Definition              | Counted when                                                                                             |
| -------------- | ----------------------- | -------------------------------------------------------------------------------------------------------- |
| **View**       | The piece page rendered | On load; deduped to 1 per (viewer, piece) per 24 h via Redis key (anonymous viewers keyed by session id) |
| **Read**       | Genuine reading started | Cumulative _active_ dwell ≥ 30 s **and** scroll depth ≥ 25 %                                             |
| **Completion** | Finished the piece      | End-of-content sentinel entered viewport **and** cumulative dwell ≥ 60 % of `reading_time_seconds`       |

_Why dwell + scroll:_ either alone is gameable — a parked tab isn't a read (tab-visibility pauses the dwell timer), and a flick-scroll to the bottom isn't a completion.

1. Page loads; client emits a `view` event. Reader chrome adapts to piece language: Urdu → `dir="rtl"`, Noto Nastaliq, line-height ≥ 2 (ADR §6/§7).
2. A passive tracker (IntersectionObserver + visibility-aware timer) accumulates dwell and max scroll depth; `read` and `completion` events fire at most once each per view.
3. Events batch to `POST /api/v1/analytics/events` (flushed every 15 s and via `sendBeacon` on unload) → append-only `analytics_events` → `analytics-rollup` updates `piece_stats` and `analytics_daily`. **Never** `COUNT(*)` or synchronous counter writes on the read path (ADR §4).

**Postconditions:** Stats eventually consistent (minutes); reading position stored client-side for scroll restoration (`11_RoutingArchitecture.md` §7).

**Edge branches:** author viewing own piece → events tagged and excluded from rollups. Unlisted → reachable by URL, `noindex`. Draft/private via URL → 404 (**not** 403 — existence is not leaked). Beacon lost on unload → accepted undercount; reconciliation is the nightly job's role.

---

## 8. Clap (≤ 50, batched) / Like / Bookmark

**Preconditions:** Authenticated; piece visible. All three are optimistic (rollback spec: `12_StateManagement.md` §4).

**8a. Clap** — enthusiasm dial, 0–50 per user (`MAX_CLAPS_PER_USER` in `@qalam/shared`):

```
tap tap tap …            UI counter +1 each tap (caps at 50, then wiggle)
   └─ debounce 600 ms ─▶ POST /api/v1/pieces/:id/claps { count: +Δ }
                          server clamps Σ(user,piece) to 50 → returns authoritative total
```

Taps accumulate a **delta** client-side; one request per burst (_Why:_ 30 taps must not be 30 writes). On error the delta rolls back visibly. Long-press = auto-repeat. First clap on a piece notifies the author (`clap`, aggregated — Flow 14).

**8b. Like** — binary toggle. `POST/DELETE /api/v1/pieces/:id/like`. Instant fill; notifies author (`like`, aggregated). Distinct from clap: like is a **signal** (feeds/trending input), clap is **applause intensity**.

**8c. Bookmark** — private save. `POST/DELETE /api/v1/pieces/:id/bookmark`; appears in `/me/bookmarks`. After bookmarking, a quiet flyout offers "Add to a reading list →" (Flow 9b). Never notifies the author (_Why:_ saving is a reader-private act).

**Postconditions:** `piece_stats` counters updated transactionally on the mutation path and reconciled nightly (ADR §4); `likes` / `claps` / `bookmarks` rows reflect the actor's state; author notifications (like/clap) aggregated per piece (Flow 14).

**Edge branches:** logged-out tap on any of the three → redirect to `/auth/login?returnTo=<current>` (guard spec, doc 11) — no dead buttons. Author self-clap/like → control hidden. Server clamp on claps means two devices tapping concurrently converge on the authoritative ≤ 50 total returned by the API.

---

## 9. Collections & reading lists

Two deliberately different containers (reader mental model: `10_InformationArchitecture.md` §3):

|               | Collection                                                  | Reading list                              |
| ------------- | ----------------------------------------------------------- | ----------------------------------------- |
| Owner curates | **Own** published pieces (a series / book)                  | **Anyone's** pieces (a playlist of saves) |
| Audience      | Public, on the owner's profile                              | Private to the reader (Phase 1)           |
| Home          | `/me/collections` · public: `/@:username/collections/:slug` | `/me/lists`                               |

**9a. Create collection & add pieces.**

1. `/me/collections` → _New collection_ → name, description, optional cover → `POST /api/v1/collections`.
2. Add pieces from the collection editor (picker over own published pieces) or from a piece's ⋯ menu → "Add to collection".
3. Manual drag ordering persists `position` on `collection_pieces`. _Why manual:_ a series has an author-intended order; recency is wrong for chapters.
4. The collection appears on the owner's public profile under a Collections tab, addressable at `/@:username/collections/:slug` (doc 10 §5).

**Postconditions:** Public, ordered grouping visible on the profile; membership independent of piece stats.

**Edge branches:** only `published` own pieces addable; unpublishing a member hides it from the public view but keeps membership (republish restores it); deleting a collection never touches its pieces.

**9b. Reading lists.**

1. Created inline from the bookmark flyout ("New list…") or at `/me/lists` → name only (private, so no cover/description ceremony).
2. Adding: bookmark flyout (Flow 8c) or the piece ⋯ menu → "Save to list". A piece may live in many lists.
3. Removing a piece from every list does **not** remove the underlying bookmark — lists organize; the bookmark is the save.

**Edge branches:** a listed piece later made private/deleted renders a tombstone row the reader can clear; lists have no public URL in Phase 1, so there is nothing to leak.

---

## 10. Follow writer · private accounts (request → approve/deny)

**10a. Public profile:** _Follow_ on `/@:username` → `POST /api/v1/users/:username/follow` → optimistic "Following"; target gets a `follow` notification; Following feed includes them immediately.

**10b. Private account** (profile boolean, ADR §4 — enforced by visibility guards in the query layer):

```
Requester                          API                      Target (private)
   │ Follow ─────────────────────▶ follow edge: pending      │
   │ button ⇒ "Requested"          ├── notifications queue ─▶│ "follow_request"
   │                               │                          │ [Approve] [Deny]
   │◀─ "follow_accepted" notif ────┤◀────── Approve ──────────┤
   │   content now visible         │        edge ⇒ accepted   │
   │        (or)                   │                          │
   │   button reverts to "Follow"  │◀─────── Deny ────────────┤
   │   — silently, no notification │        edge removed      │
```

1. Follow on a private profile creates a **pending** follow edge; button becomes "Requested" (tap again = cancel request).
2. Target sees `follow_request` with inline Approve / Deny.
3. **Approve** → edge accepted; requester notified (`follow_accepted`); private pieces become visible to them.
4. **Deny** → edge deleted; requester is **never** told (_Why:_ rejection notifications create social friction; the button simply reads "Follow" again).

**Edge branches:** account flips public with pending requests → all pending auto-accepted. Unfollow of a private account → re-following requires a new request. Private profile to a non-follower shows pen name, username, bio, counts — pieces gated behind "This account is private".

---

## 11. Repost / Quote / Write response — three distinct flows

|              | Repost                                | Quote                                      | Response                                                        |
| ------------ | ------------------------------------- | ------------------------------------------ | --------------------------------------------------------------- |
| Gesture      | One tap                               | Tap + short commentary                     | Full authored piece                                             |
| Storage      | `reposts (type='repost')`             | `reposts (type='quote')` + text            | `responses` (piece→piece) + a real `pieces` row                 |
| Appears      | Followers' Following feed, attributed | Same, commentary above embedded piece card | Reply's own `/p/:slug` **and** under the original's "Responses" |
| Notification | `repost`                              | `repost`                                   | `response`                                                      |

**11a. Repost:** ⋯ → _Repost_ → instant, optimistic; feed shows "_{penName} reposted_" above the original card. Undo from the same menu.
**11b. Quote:** ⋯ → _Quote_ → composer (plain short text, ~300 chars — **not** TipTap; a quote is a remark, not a piece) with the original embedded → post.
**11c. Write response:** _Respond_ under the piece → **full editor** (`/write?respondTo=:pieceId`) → normal Flow-5 lifecycle (draft, autosave, publish, own metadata) with `responses` linking reply→original at publish. The original shows it under "Responses (n)" ordered by engagement.

**Edge branches:** original deleted → reposts/quotes render a "no longer available" tombstone; responses survive as standalone pieces with a tombstoned context header. Private/unlisted pieces expose none of the three (visibility guards). One repost per user per piece (toggle); quotes unlimited.

---

## 12. Mentions (@username in editor → notification)

1. Writer types `@` in TipTap → mention extension (ADR §6) opens a debounced user-search popover (username + pen name + avatar).
2. Selection inserts an atomic **mention node** storing `{ userId, username }` in the document JSON. _Why store the id:_ usernames are permanent (ADR §4), but the id keeps the reference robust and renderable even if display data changes.
3. Mentions in **drafts trigger nothing.** On publish (immediate or scheduled), the server walks the canonical JSON, extracts mention nodes, dedupes per user, and enqueues `mention` notifications — capped at 20 distinct mentions per piece (`@qalam/shared` limit) to blunt spam.
4. Rendered mentions link to `/@:username`. Tapping a mention notification deep-links to the piece.

**Edge branches:** mentioned user deleted before publish → node renders as plain text, no notification. Editing a published piece to add a new mention → notifies **only** the newly added user (server diffs mention sets). Self-mentions never notify.

---

## 13. Search & discovery

**Preconditions:** none — search is public (results are visibility-filtered per actor).
**Route:** `/search?q=…&type=…&language=…&genre=…&tag=…` — every filter lives in the URL (source of truth, doc 11 §5). Backend: Postgres FTS, `simple` + `unaccent` + `pg_trgm` (ADR §3) — honest exact/fuzzy matching for Hindi/Urdu, no fake stemming.

```
 header field ── ≥2 chars, 300 ms ──▶ GET /search/suggest ──▶ dropdown (writers/titles/tags)
      │ Enter                                                        │ pick
      ▼                                                              ▼
 /search?q=…  ── tabs: Top │ Pieces │ Writers │ Tags (type=) ──▶ direct navigation
                  Pieces tab: language + genre chips (URL params)
```

1. Header search field: ≥ 2 chars, debounced 300 ms → suggestion dropdown (top writers + titles + tags), keyboard-navigable.
2. Enter → `/search?q=…`, tabs **Top / Pieces / Writers / Tags** (`type=` in URL). Pieces tab exposes language and genre filter chips.
3. Results: pieces (title/subtitle/content match, highlighted snippet), writers (username, pen name), tags (with usage counts). Cursor-paginated (§5).
4. Discovery without a query: `/feed?tab=discover` (genre/language rails, daily prompt, featured writers) and the taxonomy hubs `/tag/:slug`, `/genre/:slug`.

**Edge branches:** empty results → per-script "no matches" state suggesting trending tags in the user's UI language. Private-account pieces never appear for non-approved searchers (visibility guards run inside search queries too). Rate-limited per user/IP.

---

## 14. In-app notifications

In-app **only** (ADR §10 — no push, no digest email in Phase 1). Bell in the header with unread badge; panel lists newest-first, cursor-paginated; open → mark-seen; per-row mark-read on click-through.

| Type              | Triggered by                                     | Payload → deep link          | Aggregated?                         |
| ----------------- | ------------------------------------------------ | ---------------------------- | ----------------------------------- |
| `follow`          | New follower (public profile)                    | actor → `/@:actor`           | Yes — "A and 3 others followed you" |
| `follow_request`  | Follow on private account (Flow 10b)             | actor + inline Approve/Deny  | No — each is actionable             |
| `follow_accepted` | Private account approved you                     | target profile               | No                                  |
| `like`            | First like per actor per piece                   | piece → `/p/:slug`           | Yes — per piece                     |
| `clap`            | First clap per actor per piece                   | piece                        | Yes — per piece                     |
| `response`        | Response published to your piece (Flow 11c)      | the response piece           | No                                  |
| `mention`         | Mention published (Flow 12)                      | mentioning piece             | No                                  |
| `repost`          | Repost **or** quote of your piece                | actor + your piece           | Yes — per piece                     |
| `featured`        | Admin features you (`/featured`, Flow via admin) | your profile / featured slot | No                                  |

Delivery pipeline:

```
 engagement mutation ──▶ notifications queue ──▶ worker: aggregate per (recipient,
 (like/clap/follow/…)      (BullMQ, Redis DB 1)   piece, type, rolling window)
                                                        │
                                   notifications rows + unread counter (Redis)
                                                        │
 bell badge ◀── qk.notifications.unreadCount() — refetch on window focus + 60 s poll
```

Polling, not WebSocket, in Phase 1 (_Why:_ the queue-backed model upgrades to sockets later without any schema change, and a 60 s badge lag is acceptable for a literary platform). Opening the panel marks items _seen_ (badge clears); clicking through marks that item _read_.

---

## 15. Report content → moderation queue → action

**15a. Reporter (any user):** ⋯ on piece or profile → _Report_ → reason (`spam | harassment | plagiarism | adult_content | other` + optional note ≤ 500 chars) → `POST /api/v1/reports` → "Thanks — our moderators will review this." One open report per (reporter, target); duplicates raise the existing report's weight instead (409 surfaced as a friendly "already reported" note). Reporters are **not** notified of outcomes (`featured`-style closure notifications are deliberately out of the ADR type set).

**15b. Moderation (admin app `/reports`):** offset-paginated table (ADR §5 — admin tables need totals); filters: status (`pending | in_review | resolved | dismissed`), reason, target type; sorted by report count then age.

```
 Moderator opens report ──▶ detail: target rendered in-context, reporter notes,
        │                   target author's history (prior reports, strikes)
        ▼
   claim (status ⇒ in_review, assigned to me — prevents double-handling)
        ▼
 ┌─ Dismiss ──────────── report ⇒ dismissed, no target change ──────────────┐
 ├─ Remove content ───── piece unpublished (hidden, soft-deleted), author   │──▶ audit_logs row
 │                       sees "removed for violating guidelines" on it      │    (actor, action,
 ├─ Warn user ────────── strike recorded on the user                        │    target, reason)
 └─ Suspend user ─────── ADMIN ONLY: account locked, sessions revoked ──────┘
```

**RBAC (ADR §8):** `moderator` may claim/dismiss/remove/warn; **suspend** requires `admin`+; a moderator escalates instead (report flagged `escalated`). Every action writes `audit_logs` (ADR §8 — audit on every admin mutation), immutably.

**Edge branches:** target deleted before review → report auto-resolves `target_gone`. Suspension revokes all refresh tokens immediately (same mechanism as Flow 3 step 4); suspended users hit a static "account suspended" interstitial on next request.

---

## 16. Writer views analytics

**Preconditions:** Authenticated; owns ≥ 1 published piece. **Route:** `/me/stats?range=30d` (range in URL: `7d | 30d | 90d | all`).

```
┌ /me/stats ────────────────────────────────── range: [7d|30d|90d|all] ┐
│ ┌ Views ┐ ┌ Reads ┐ ┌ Read time ┐ ┌ Completion ┐ ┌ Shares ┐ ┌ +Followers ┐
│ ├──────────────────── per-piece table (sortable) ────────────────────┤
│ │ piece · views · reads · completion% · claps · likes · responses    │
│ ├──────────────┬──────────────────────┬─────────────────────────────┤
│ │ traffic mix  │ countries            │ devices                     │
└─┴──────────────┴──────────────────────┴─────────────────────────────┘
```

1. **Overview cards** (ADR-locked metric set): views, reads, reading time (total + median), completion rate, shares, follower delta — for the selected range, with prior-period comparison.
2. **Per-piece table:** views / reads / completion % / claps / likes / responses per piece; sortable; row → per-piece drill-down with a daily time series.
3. **Audience panels:** traffic sources (internal feed / search / tag & genre hubs / direct / external referrer), countries, devices.
4. All served from `analytics_daily` aggregates (ADR §4) — _Why:_ dashboards never scan raw `analytics_events` partitions. Freshness label: "Updated nightly · today so far is preliminary" (today's slice reads the current rollup increment, marked provisional).

**Edge branches:** no published pieces → empty state pointing at `/write`. Newly published piece → visible in the table immediately with dashes until the first rollup. Writers see **only their own** numbers; platform-wide analytics live in the admin app (`/analytics`), gated `admin`+.

---

## Cross-flow invariants

1. **Every mutation is optimistic only if it is trivially reversible** (clap, like, bookmark, follow, repost). Publishing, scheduling, reporting, and account mutations always wait for the server.
2. **Guests are redirected, never dead-ended:** any auth-required action from a Visitor routes to `/auth/login?returnTo=<current URL>` and resumes after login (doc 11 §4).
3. **Visibility is enforced server-side** (query-layer guards, ADR §4). The client hides controls as a courtesy; it is never the enforcement point.
4. **Nothing user-facing blocks on a queue.** Queues (`notifications`, `analytics-rollup`, `scheduled-publish`, `emails`) deliver eventual effects; the interactive request path stays fast.
