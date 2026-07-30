# 18 — Development Roadmap

> **Status:** Binding plan of record. Derives from `00_ArchitectureDecisions.md` §10
> (product decisions locked by the brief). Phases are sequential; epics inside Phase 1
> are ordered by dependency, not preference. Estimates are in **engineer-weeks (ew)** —
> focused work by one engineer, excluding review/coordination overhead (budget +25%
> calendar time on top).
>
> Task flags: **[J]** junior-safe (patterns exist, blast radius contained) ·
> **[S]** senior-required (security surface, novel design, or cross-cutting).

---

## Phase 0 — Foundation ✅ (this phase, complete)

Everything that lets Phase 1 start on rails instead of gravel:

| Deliverable                                                                                                                                          | State |
| ---------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| Monorepo: pnpm 9 workspaces + Turborepo 2, `@qalam/*` packages built with tsup                                                                       | ✅    |
| Architecture docs `00–18`, `CLAUDE.md` engineering handbook                                                                                          | ✅    |
| Backend scaffold: NestJS 11 bootstrap (helmet, CORS, versioning, pipes, Swagger, Pino), Zod env validation, TypeORM data source + migration pipeline | ✅    |
| Frontend/admin scaffold: React 19 + Vite 7, providers, router, api-client, theme/RTL wiring                                                          | ✅    |
| `@qalam/config` (tsconfig/eslint/prettier presets incl. the physical-direction-class ban), `@qalam/ui` tokens + AntD theme + Tailwind preset         | ✅    |
| dev infra: docker-compose (postgres 16, redis 7, minio, mailpit), nginx templates, Dockerfiles                                                       | ✅    |
| CI: `ci.yml` (lint → typecheck → test → build, turbo-cached), commit/PR-title enforcement, husky hooks                                               | ✅    |
| Design system spec: tokens, type scale, fonts (Inter/Lora/Noto family incl. Nastaliq), spacing/radii/elevation (ADR §7)                              | ✅    |

**Exit criterion (met):** a new engineer clones, runs `pnpm i && docker compose up -d
&& pnpm dev`, and has API + both apps hot-reloading against local infra in < 15 minutes.

---

## Phase 1 — MVP (the core product)

Goal: a writer can register, write in Hindi or Urdu (RTL correct), publish, be read,
be found, and be followed — and we can moderate all of it. Ten epics, ~40 ew of build.

### Epic dependency graph

```
                 ┌──────────────────────────────────────────────────────────┐
                 │  E1 Auth & Identity                                      │
                 └──┬───────────────┬───────────────────────────┬───────────┘
                    ▼               ▼                           ▼
        ┌───────────────────┐  ┌──────────────────┐   ┌─────────────────────┐
        │ E2 Profiles &     │  │ E3 Editor &      │   │ E10 Admin &         │
        │    Follow graph   │  │    Drafts        │   │     Moderation core │◀─┐
        └───────┬───────────┘  └────────┬─────────┘   └─────────────────────┘  │
                │                       ▼                                      │
                │              ┌──────────────────┐                            │
                │              │ E4 Publishing    │────────────────────────────┘
                │              └────────┬─────────┘        (needs pieces to moderate)
                │                       ▼
                │              ┌──────────────────┐
                │              │ E5 Reading exp.  │
                │              └────────┬─────────┘
                ▼                       ▼
        ┌─────────────────────────────────────────┐
        │ E6 Feeds          E7 Social & Curation  │
        └───────┬──────────────────┬──────────────┘
                ▼                  ▼
        ┌──────────────┐   ┌──────────────────┐
        │ E8 Search    │   │ E9 Notifications │
        └──────────────┘   └──────────────────┘
```

Parallelization guide: after E1 lands, one track runs E2→E6/E7 (social spine) while the
other runs E3→E4→E5 (writing spine). E10 starts as soon as E4 produces pieces to
moderate. E8/E9 are end-of-phase and independent of each other.

---

### E1 — Auth & Identity (4 ew)

**Scope:** email+password registration/login, Google OAuth (code + PKCE), username
permanence, session/refresh lifecycle. Per ADR §3: JWT access 15 min + rotating refresh
30 days, httpOnly cookie (web) / body (mobile-ready), Argon2id, reuse-detection denylist
in Redis DB 3. Apple login is explicitly Phase 2.

- Registration with email verification (Mailpit dev, SMTP prod), Argon2id hashing
- Username claim at registration: unique `citext`, immutable, 3–30 `^[a-z0-9_]+$` (ADR §4)
- Login, logout (single + all-sessions), forgot/reset password
- Google OAuth → `auth_identities` row; account-link when email matches verified email
- Refresh rotation with reuse detection; strict rate-limit tiers on all auth endpoints

**Tasks**

| #   | Task                                                                          | Flag |
| --- | ----------------------------------------------------------------------------- | ---- |
| 1   | `users` + `auth_identities` entities, migration, repositories                 | [J]  |
| 2   | Registration + email verification flow (token, expiry, resend)                | [J]  |
| 3   | Argon2id hashing service + credential validation                              | [S]  |
| 4   | JWT issuance: access/refresh pair, cookie vs body strategies                  | [S]  |
| 5   | Refresh rotation + reuse-detection denylist (Redis DB 3)                      | [S]  |
| 6   | Google OAuth (code + PKCE) + identity linking rules                           | [S]  |
| 7   | Guards: `JwtAuthGuard`, `@CurrentUser()`, `@Public()` decorators              | [J]  |
| 8   | Rate limiting on auth endpoints (Redis sliding window)                        | [J]  |
| 9   | Forgot/reset password flow                                                    | [J]  |
| 10  | Frontend: auth pages (`/auth/*`), session bootstrap, api-client refresh-retry | [J]  |
| 11  | e2e suite: full lifecycle incl. token-reuse attack path                       | [S]  |

**Depends on:** — (first epic).
**Acceptance:** register→verify→login→refresh→logout works on web with httpOnly cookies;
a replayed refresh token kills the whole session family; username collision returns
`AUTH_USERNAME_TAKEN`; Google sign-in creates or links correctly; auth endpoints
rate-limited; e2e green.

---

### E2 — Profiles & Follow Graph (3 ew)

**Scope:** public profile (`/@:username`), pen name (single, changeable — ADR §4),
avatar/bio/links, follow/unfollow, **private accounts** with follow-request flow,
follower/following lists.

- `profiles`, `follows` entities; profile edit (`/settings/profile`)
- Avatar upload via media pre-signed flow (thin slice of E-media, see task 4)
- Private accounts: boolean on profile; visibility enforced in repository query scopes
  (ADR §4 — query layer, not RLS); follow requests: pending → accepted/declined
- Follower/following lists with cursor pagination

**Tasks**

| #   | Task                                                                            | Flag |
| --- | ------------------------------------------------------------------------------- | ---- |
| 1   | `profiles` + `follows` entities, migrations (follows: composite unique, status) | [J]  |
| 2   | Profile CRUD service + `/@:username` public endpoint                            | [J]  |
| 3   | Follow/unfollow + private-account request/accept/decline state machine          | [S]  |
| 4   | Media module thin slice: pre-signed avatar upload + sharp re-encode worker      | [S]  |
| 5   | Visibility scope helper (shared repository scope for private accounts)          | [S]  |
| 6   | Follower/following list endpoints, cursor-paginated                             | [J]  |
| 7   | Frontend: profile page, edit form (RHF+Zod), follow button states               | [J]  |
| 8   | Frontend: settings pages (`/settings/{profile,account,appearance}`)             | [J]  |

**Depends on:** E1.
**Acceptance:** private profile's content invisible to non-approved viewers on **every**
endpoint (verified by e2e matrix); pen name changes reflect everywhere; username never
changes; avatar EXIF-stripped; follow counts consistent under concurrent requests.

---

### E3 — Editor & Drafts (5 ew)

**Scope:** TipTap 3 editor at `/write` and `/write/:draftId`, autosave, and the Phase 1
custom extensions: **footnotes, mentions, hashtags** plus marks (bold, italic,
underline, alignment, blockquote, lists — ADR §10). Content stored as TipTap JSON
canonical; `content_text`, `word_count`, `reading_time_seconds` derived on write (ADR §4).

- Draft CRUD (`pieces` with `status = draft`); autosave (debounced, dirty-state, conflict
  guard via `updated_at` precondition)
- Per-piece language selection (one language per piece) driving `dir` + reading font
- RTL-correct editing for Urdu including alignment behavior and mixed-direction lines
- Mention suggestions (username search), hashtag parsing into pending tags

**Tasks**

| #   | Task                                                                                                              | Flag |
| --- | ----------------------------------------------------------------------------------------------------------------- | ---- |
| 1   | `pieces` entity (draft fields), `languages` seed, migrations                                                      | [J]  |
| 2   | Draft CRUD endpoints + repository (author-scoped)                                                                 | [J]  |
| 3   | TipTap document schema: allowed marks/nodes, server-side sanitization of stored JSON                              | [S]  |
| 4   | Derivation pipeline: JSON → `content_text` / `word_count` / `reading_time_seconds` (in `@qalam/utils` where pure) | [J]  |
| 5   | Editor shell: toolbar, language picker, `dir` switching, reading-font preview                                     | [S]  |
| 6   | Autosave hook: debounce, retry, conflict detection (`PIECE_STALE_WRITE`)                                          | [S]  |
| 7   | Footnotes extension (insert, render, reorder)                                                                     | [S]  |
| 8   | Mentions extension + username-suggest endpoint                                                                    | [J]  |
| 9   | Hashtags extension + parse-on-save into piece tag candidates                                                      | [J]  |
| 10  | `/me/drafts` list with resume, delete (soft), duplicate                                                           | [J]  |
| 11  | Editor unit/behavior tests incl. RTL alignment cases                                                              | [S]  |

**Depends on:** E1 (author identity). Mentions link to E2 profiles but degrade to plain
text until E2 ships.
**Acceptance:** a 5,000-word Urdu draft edits smoothly, autosaves within 3 s of idle,
survives tab crash; footnotes/mentions/hashtags round-trip through JSON storage
losslessly; two tabs on one draft can't silently clobber each other.

---

### E4 — Publishing (3 ew)

**Scope:** draft → preview → publish pipeline with the full publish sheet: title,
subtitle, cover image, featured quote, tags, genre, language, visibility, **scheduled
publish** (ADR §10). Slug generation; `Idempotency-Key` on publish (ADR §5).

- Publish sheet (frontend) + `POST /pieces/:id/publish` with all metadata
- Preview mode rendering exactly as readers will see it (same renderer as E5)
- Scheduled publish: BullMQ `scheduled-publish` delayed job + outbox row in the publish
  transaction; reschedule/cancel; `PIECE_SCHEDULE_IN_PAST` validation
- Unpublish/republish rules; `piece_stats` row created transactionally on publish

**Tasks**

| #   | Task                                                                                                                     | Flag |
| --- | ------------------------------------------------------------------------------------------------------------------------ | ---- |
| 1   | Taxonomy slice: `genres`, `tags`, `piece_tags` entities + admin-seedable genres                                          | [J]  |
| 2   | Publish service: state transitions, transaction (piece + stats + tags), slug strategy (unicode-safe, collision-suffixed) | [S]  |
| 3   | Scheduled publish: delayed job, outbox, reschedule/cancel, worker idempotency                                            | [S]  |
| 4   | Cover image upload (reuses E2 media slice; card-size renditions)                                                         | [J]  |
| 5   | `Idempotency-Key` support on publish endpoint                                                                            | [S]  |
| 6   | Frontend: publish sheet (all fields, validation, cover crop)                                                             | [J]  |
| 7   | Frontend: preview route using the shared reading renderer                                                                | [J]  |
| 8   | e2e: publish now, publish scheduled, cancel schedule, double-submit safety                                               | [S]  |

**Depends on:** E3 (drafts). E10's moderation views consume its output.
**Acceptance:** scheduled piece publishes within 60 s of target time even across API
restarts (job survives; worker idempotent); double-clicking Publish creates exactly one
publication; slugs stable and collision-free; preview is pixel-identical to the live
reading view.

---

### E5 — Reading Experience (4 ew)

**Scope:** the product's soul — `/p/:slug` reading view with premium typography, and the
tracking that feeds analytics: **views, reads, reading time, completion** (ADR §10).

- Reading renderer from TipTap JSON: 65–72ch column, Lora / Noto Serif Devanagari /
  **Noto Nastaliq Urdu** with line-height 2.1 and larger base size (ADR §7)
- `dir` per content language; footnote rendering/jump; both themes
- Tracking beacons → `analytics_events` (append-only, monthly partitions — ADR §4):
  view (dedup by viewer/day), read (threshold), reading-time heartbeats, completion (scroll depth)
- Piece meta: author card, stats display, share (E7 wires actions)

**Tasks**

| #   | Task                                                                                          | Flag |
| --- | --------------------------------------------------------------------------------------------- | ---- |
| 1   | Shared reading renderer (JSON → React) used by E4 preview + this view                         | [S]  |
| 2   | Typography implementation per script incl. Nastaliq metrics tuning                            | [S]  |
| 3   | Nastaliq QA harness: golden-sample pages (poetry, prose, mixed EN/UR) screenshot-diffed in CI | [S]  |
| 4   | `analytics_events` partitioned table + ingestion endpoint (batched beacon)                    | [S]  |
| 5   | Client tracking hook: visibility, scroll-depth, heartbeat, offline-tolerant flush             | [S]  |
| 6   | View dedup + read/completion threshold rules (documented constants in `@qalam/shared`)        | [J]  |
| 7   | Piece page chrome: author card, follow CTA, stats strip                                       | [J]  |
| 8   | `analytics-rollup` job: events → `analytics_daily`                                            | [S]  |
| 9   | A11y pass: keyboard nav, focus order, reduced motion, AA contrast in both themes              | [J]  |

**Depends on:** E4 (published pieces).
**Acceptance:** Urdu piece renders in Nastaliq with no clipped ascenders/descenders at
any breakpoint (golden samples pass); refresh-spamming doesn't inflate views; completion
tracks within ±5% of actual scroll behavior; rollup job reconciles to raw events.

---

### E6 — Feeds (4 ew)

**Scope:** `/feed` with tabs in the URL: **Following / Latest** first, then **Trending**
(scoring job) and **Discover** (ADR §10). Cursor pagination throughout (ADR §5).

- Following: pieces from followed authors, private-visibility respected
- Latest: global recency, language-filterable
- Trending: `trending-score` BullMQ job — time-decayed engagement score into a
  materialized ranking (reads `piece_stats` + recent events); recomputed on schedule
- Discover: genre/language sampling + `featured_writers` (admin-curated, E10)

**Tasks**

| #   | Task                                                                               | Flag |
| --- | ---------------------------------------------------------------------------------- | ---- |
| 1   | Feed query repository: cursor over `(published_at, id)`, visibility scopes         | [S]  |
| 2   | Following + Latest endpoints with language filter                                  | [J]  |
| 3   | Trending score design: decay function, weights, floor/ceiling (documented in-code) | [S]  |
| 4   | `trending-score` job + ranking storage (Redis DB 0 cache, PG source of truth)      | [S]  |
| 5   | Discover composition: genre buckets + featured slots                               | [J]  |
| 6   | Frontend: feed page, URL-driven tabs, infinite scroll (TanStack Query cursors)     | [J]  |
| 7   | Piece cards (list + card variants), skeletons, empty states — RTL-safe             | [J]  |
| 8   | Feed e2e: pagination stability under concurrent inserts, private-account exclusion | [S]  |

**Depends on:** E2 (follow graph), E4 (published pieces). Trending quality improves once
E5/E7 emit engagement, but ships against likes/views available at the time.
**Acceptance:** no duplicated/skipped items across cursor pages under concurrent
publishing; Following never leaks private pieces; trending updates within one job cycle;
tab state survives refresh/share via URL.

---

### E7 — Social & Curation (6 ew)

**Scope:** the full locked social surface (ADR §10): **like, clap (≤ 50/user/piece),
bookmark, collections, reading lists, repost, quote, write response, share**.

- Likes (toggle), claps (accumulating to `MAX_CLAPS_PER_USER = 50`), bookmarks
- Collections (writer-curated, public/private) + reading lists (reader-curated) —
  distinct tables per ADR §4, distinct UX
- Repost & quote (`reposts` with type), responses (`responses`, piece→piece)
- Share: canonical URLs + OG/social card meta (card templates arrive via E10)
- All counters via transactional `piece_stats` updates (ADR §4)

**Tasks**

| #   | Task                                                                                    | Flag |
| --- | --------------------------------------------------------------------------------------- | ---- |
| 1   | `likes`, `claps`, `bookmarks` entities + toggle/increment endpoints                     | [J]  |
| 2   | Clap accumulation with cap enforcement, race-safe (upsert + check)                      | [S]  |
| 3   | `piece_stats` transactional counter service + nightly reconciliation job                | [S]  |
| 4   | Collections CRUD + piece membership + `/me/collections`                                 | [J]  |
| 5   | Reading lists CRUD + `/me/lists`                                                        | [J]  |
| 6   | Repost/quote model + feed integration (reposts surface in Following)                    | [S]  |
| 7   | Responses: compose-from-piece flow, threading display on parent piece                   | [S]  |
| 8   | Share: canonical URL, OG meta endpoint/tags per piece                                   | [J]  |
| 9   | Frontend: engagement bar (like/clap/bookmark animations, optimistic updates + rollback) | [J]  |
| 10  | Frontend: collection/list management surfaces, add-to sheets                            | [J]  |
| 11  | e2e: cap enforcement, idempotent toggles, private-piece engagement rules                | [S]  |

**Depends on:** E5 (reading view hosts the engagement bar), E2 (identity/visibility).
**Acceptance:** 51st clap is rejected server-side regardless of client; optimistic UI
reconciles on failure; stats drift caught by reconciliation is zero in steady state;
reposts respect source-piece visibility.

---

### E8 — Search & Discovery (3 ew)

**Scope:** `/search` across **writer / title / tag / genre / language** (ADR §10) on
**Postgres FTS**: generated `tsvector` + GIN, `simple` config + `unaccent` + `pg_trgm`
for Hindi/Urdu (ADR §3). Swappable behind `SearchService` — Meilisearch is the
designated successor if outgrown.

**Tasks**

| #   | Task                                                                                                                                  | Flag |
| --- | ------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| 1   | Migration: `tsvector` generated columns (pieces: title/subtitle/content_text; profiles: username/pen_name/bio), GIN + trigram indexes | [S]  |
| 2   | `SearchService` interface + Postgres implementation (rank: exact > prefix > trigram)                                                  | [S]  |
| 3   | Search endpoints: pieces, writers; filters (tag/genre/language); cursor pagination                                                    | [J]  |
| 4   | Relevance test corpus: curated Hindi/Urdu/Hinglish queries with expected orderings as integration tests                               | [S]  |
| 5   | Frontend: `/search` with URL-held query + filters, grouped results                                                                    | [J]  |
| 6   | Tag/genre browse pages (`/tag/:slug`, `/genre/:slug`)                                                                                 | [J]  |
| 7   | Search analytics event (query, zero-result flag) for future tuning                                                                    | [J]  |

**Depends on:** E4 (content), E2 (writers). Feeds independent.
**Acceptance:** Urdu/Hindi queries match with and without diacritics; typo-tolerant via
trigram; zero-result rate measurable; p95 search < 150 ms at Phase-1 data volumes;
relevance corpus green in CI.

---

### E9 — Notifications (2.5 ew)

**Scope:** **in-app only** (ADR §10 — no email/push in Phase 1). Events: new follower,
follow request (+accepted), like/clap milestone, response to your piece, mention,
repost/quote, moderation actions against your content.

**Tasks**

| #   | Task                                                                             | Flag |
| --- | -------------------------------------------------------------------------------- | ---- |
| 1   | `notifications` entity (discriminated payload per type — see 16 §1.3), migration | [J]  |
| 2   | `notifications` BullMQ queue + fan-out worker consuming domain events            | [S]  |
| 3   | Aggregation rules ("N people liked", milestone thresholds) + dedup windows       | [S]  |
| 4   | Endpoints: cursor list, unread count, mark read/mark-all                         | [J]  |
| 5   | Frontend: bell + panel, unread badge (polling now; SSE seam left in api-client)  | [J]  |
| 6   | Preference stub: per-type on/off on profile (schema now, full UI later)          | [J]  |

**Depends on:** E2, E7 (they emit the events); worker degrades gracefully for
not-yet-shipped event types.
**Acceptance:** every listed event notifies exactly once (dedup verified); like-storms
aggregate instead of flooding; unread count consistent with list; panel RTL-correct.

---

### E10 — Admin & Moderation Core (6 ew)

**Scope:** the admin app (`admin.qalam.*`, AntD-heavy) covering the locked surface
(ADR §10): **dashboard, users, pieces, reports, roles, audit logs, languages, prompts,
featured writers, card templates** + moderator management. RBAC
`user < moderator < admin < super_admin` (ADR §8); **audit log on every admin mutation**.

**Tasks**

| #   | Task                                                                                                    | Flag |
| --- | ------------------------------------------------------------------------------------------------------- | ---- |
| 1   | RBAC: `roles`, `user_roles`, `@Roles()` guard + decorator, role hierarchy checks                        | [S]  |
| 2   | `audit_logs` + audit interceptor (actor, action, target, before/after diff) on all admin mutations      | [S]  |
| 3   | Reports: `reports` entity, user-facing report endpoint, moderation queue (claim, resolve, action taken) | [S]  |
| 4   | Admin users management: search, view, suspend/restore (soft delete), role assignment                    | [J]  |
| 5   | Admin pieces management: search, view, unpublish/restore, offset pagination (ADR §5)                    | [J]  |
| 6   | Languages management (enable/disable, script/direction metadata)                                        | [J]  |
| 7   | Daily prompts CRUD + scheduling; surfaces on frontend write flow                                        | [J]  |
| 8   | Featured writers curation (feeds Discover, E6)                                                          | [J]  |
| 9   | Card templates CRUD + share-card render pipeline (feeds E7 share)                                       | [S]  |
| 10  | Dashboard: key metrics tiles from `analytics_daily`                                                     | [J]  |
| 11  | Admin app shell: AntD tables/forms throughout, route guards per role                                    | [J]  |
| 12  | e2e: privilege-escalation matrix (each role × each admin endpoint)                                      | [S]  |

**Depends on:** E1 (auth), E4 (pieces exist). Starts in parallel with E5.
**Acceptance:** no admin mutation without an audit row (interceptor-enforced, tested);
moderator cannot reach admin-only endpoints (matrix green); report → action → author
notification loop closes; suspended user loses access within one access-token TTL (15 min).

---

### Phase 1 tally

| Epic                  | ew  |     | Epic                   | ew  |
| --------------------- | --- | --- | ---------------------- | --- |
| E1 Auth & Identity    | 4.0 |     | E6 Feeds               | 4.0 |
| E2 Profiles & Follow  | 3.0 |     | E7 Social & Curation   | 6.0 |
| E3 Editor & Drafts    | 5.0 |     | E8 Search              | 3.0 |
| E4 Publishing         | 3.0 |     | E9 Notifications       | 2.5 |
| E5 Reading Experience | 4.0 |     | E10 Admin & Moderation | 6.0 |

**Total ≈ 40.5 ew** → with the team below (~4 delivery engineers), **~12–13 calendar
weeks** including the +25% coordination overhead.

---

## Phase 1.5 — Hardening (≈ 6 ew)

Ship-quality is Phase 1's bar; _operate_-quality is this phase's. No new product surface.

| Workstream                 | Contents                                                                                                                                                         | ew  |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- |
| Writer analytics dashboard | `/me/stats`: views, reads, reading time, completion, shares, followers, traffic sources, countries, devices (ADR §10) — reads `analytics_daily`, no new tracking | 2.0 |
| Prometheus + Grafana       | `/metrics` (HTTP latency/throughput, queue depth/age, DB pool, cache hit rate), dashboards + alert rules (queue lag, 5xx, p95, scheduled-publish delay)          | 1.5 |
| Testcontainers e2e         | Real Postgres + Redis per e2e suite in CI; migrate the Supertest suites off mocks for repository-heavy paths                                                     | 1.5 |
| Performance passes         | Feed/search EXPLAIN audits, N+1 sweep, cache TTL tuning (Redis DB 0), bundle budgets (route-split, font subsetting per script), image rendition audit            | 1.0 |

**Exit criterion:** on-call engineer can diagnose a slow feed or stuck queue from
dashboards alone; e2e suite catches a bad migration before staging does.

---

## Phase 2 — Monetization & Intelligence

| Track              | Scope                                                                                                                                                                                                                                                                                                                                   | Status of design |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| **AI system**      | **Placeholder — explicitly not designed yet.** The brief locks AI entirely out of Phase 1; no architecture in this repo presumes any AI feature. When Phase 2 planning starts, it gets its own ADR section + design doc (candidate areas named by the brief only as "AI"; scope, models, and data-use policy all TBD there — not here). | Not designed     |
| Payments           | Subscriptions/support for writers; provider abstraction; entirely absent from Phase 1 schema by design (no premature `plan` columns)                                                                                                                                                                                                    | Not designed     |
| Apple login        | Deferred from E1 (ADR §3); slots into `auth_identities` without migration pain                                                                                                                                                                                                                                                          | Seam ready       |
| Advanced analytics | Cohorts, retention curves, per-piece funnels; builds on `analytics_events` partitions + rollups from E5                                                                                                                                                                                                                                 | Data model ready |

**Why placeholders are honest:** writing speculative designs for undecided features
produces documents that are wrong the day the feature is actually scoped. We record the
seams (auth identity table, analytics partitions, provider-agnostic media/search
services) and stop there.

## Phase 3 — Global Multilingual Expansion

- **UI i18n via `react-i18next`** (the ADR §6 plan): UI-chrome language independent of
  content language — the two-axes rule holds; RTL UI chrome (not just content) becomes
  first-class when Arabic/Persian UI locales land.
- **More scripts:** font pipeline extends per script (self-hosted @fontsource); each new
  script gets golden-sample rendering tests like Nastaliq's (E5 task 3 pattern).
- **Meilisearch if FTS outgrows:** the `SearchService` seam (E8) is the swap point;
  trigger criteria: sustained p95 > 300 ms, zero-result rate not improvable in PG, or
  cross-script relevance demands real per-language analyzers.
- **Mobile parity:** Flutter consumes the same `openapi.json` (ADR §2); API was
  mobile-shaped from day one (refresh-in-body strategy, cursor pagination).

---

## Team Shape (Phase 1)

| Role                 | Count | Primary lane                                                                                  |
| -------------------- | ----- | --------------------------------------------------------------------------------------------- |
| Backend engineers    | 2     | Split spines: (auth/social: E1→E2→E6/E7/E9) and (content: E3-API→E4→E5-tracking→E8, then E10) |
| Frontend engineers   | 2     | One on reader/writer app (editor, reading, feeds), one on engagement surfaces + admin app     |
| Product designer     | 1     | Two epics ahead of build; owns typography QA (Nastaliq golden samples) with FE                |
| Tech lead (hands-on) | 1     | Contracts (`shared`, `api-types`), migrations review, [S] tasks arbitration, unblocking       |

Six people. Smaller works if the calendar stretches; adding a third backend engineer
before E7/E10 is the highest-leverage scale-up.

## Top Risks & Mitigations

| #   | Risk                                                                                                                                                      | Impact | Mitigation                                                                                                                                                                                                     |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Nastaliq rendering quality** — Noto Nastaliq Urdu is vertically demanding; clipping/overlap ruins the "premium sanctuary" promise for the core audience | High   | Golden-sample screenshot tests in CI from E5 day one (poetry, long prose, mixed-direction); line-height ≥ 2 + larger base size locked in tokens; designer sign-off gate on Urdu pages; fallback chain tested   |
| 2   | **RTL regressions** — one physical-direction class breaks Urdu layouts silently                                                                           | High   | Lint-level HARD BAN (16 §4.6) fails CI; PR template demands RTL screenshots on layout changes; weekly RTL smoke pass of top 10 screens                                                                         |
| 3   | **FTS relevance for Hindi/Urdu** — no PG stemmers; `simple` + trigram may feel dumb                                                                       | Medium | Relevance corpus as CI tests (E8 task 4); zero-result analytics from launch; `SearchService` seam keeps Meilisearch a swap, not a rewrite                                                                      |
| 4   | **Scheduled publish reliability** — a silently missed schedule destroys writer trust disproportionately                                                   | High   | Outbox row in publish transaction + BullMQ delayed job + idempotent worker (E4); Grafana alert on schedule-to-publish lag (Phase 1.5); reconciliation sweep for overdue rows                                   |
| 5   | **Moderation load** — social features generate reports faster than a small team triages                                                                   | Medium | E10 ships _with_ the social epics, not after; report queue has claim/age metrics from day one; rate limits + clap caps bound abuse mechanics; roles allow recruiting community moderators without code changes |
| 6   | **Scope creep on social features** — "just add polls/DMs/comments-on-paragraphs"                                                                          | High   | ADR §10 is the locked list; anything beyond it requires an ADR amendment PR (2 approvals incl. lead) landing in Phase 2+, never mid-epic                                                                       |
| 7   | **Monorepo CI time** — full-graph runs creep past 10 min and stall the <3-day branch rule                                                                 | Medium | Turbo remote caching from Phase 0; affected-only task graph on PRs; CI-duration tracked in Grafana with a 10-min budget alert; heavy suites (Testcontainers, screenshots) sharded                              |
| 8   | **Solo-language reviewers** — only one team member reads Urdu (or Hindi) fluently; their absence blocks typography/relevance/moderation judgment          | Medium | Golden samples + relevance corpus encode their judgment into CI (reviewable by anyone thereafter); document script-specific rules in `docs/`; budget for external native-speaker QA passes before launch       |

---

_Sequence is the strategy: identity before content, content before distribution,
moderation alongside social — and every "later" (AI, payments, Meilisearch, mobile) has
a seam already paid for._
