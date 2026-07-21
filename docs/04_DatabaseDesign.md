# 04 — Database Design

> **Derives from:** `00_ArchitectureDecisions.md` §4 (Database Decisions). This document
> expands the master ADR into the full physical schema. It never contradicts the ADR; if a
> conflict is ever found, the ADR wins and this file gets fixed.

- **Engine:** PostgreSQL 16 · **ORM:** TypeORM ^0.3 (`SnakeNamingStrategy`)
- **Migrations only.** `synchronize: false` in every environment, including local dev.

---

## 1. Conventions

### 1.1 Naming

| Thing      | Convention                 | Example                          |
| ---------- | -------------------------- | -------------------------------- |
| Tables     | `snake_case`, **plural**   | `reading_list_pieces`            |
| Columns    | `snake_case`               | `published_at`                   |
| PK         | `id` (exceptions in §1.3)  |                                  |
| FK columns | `<singular>_id`            | `author_id`, `piece_id`          |
| Indexes    | `idx_<table>_<cols>`       | `idx_pieces_author_status`       |
| Unique     | `uq_<table>_<cols>`        | `uq_likes_user_piece`            |
| Checks     | `chk_<table>_<rule>`       | `chk_claps_count_range`          |
| Enums (PG) | `<domain>_<noun>` singular | `piece_status`, `text_direction` |

### 1.2 Primary keys — UUIDv7, application-generated

All surrogate PKs are **UUIDv7 generated in the application** (PG16 has no native v7;
`uuid-ossp` is therefore **not installed**).

**Why v7 over v4.** v4 is uniformly random — every insert lands at a random B-tree page:
page splits, cold buffers, index bloat. v7 is time-ordered in its high bits, so inserts
append to the right edge of the index like a bigserial, preserving index locality and a
hot working set. Public URLs never expose raw IDs — routing is by `slug` and `username`.

### 1.3 Deliberate PK exceptions (still UUIDv7 values)

- **1:1 satellites** (`piece_stats`) — PK is the parent's id (`piece_id`); a second
  identifier would add an index and buy nothing.
- **Pure two-column M:N joins** (`piece_tags`, `user_roles`) — composite PK of the two
  FKs; a surrogate `id` would just duplicate the unique constraint we need anyway.

Every other table has an `id uuid` PK.

### 1.4 Base columns

| Column       | Type                                 | Applies to                        |
| ------------ | ------------------------------------ | --------------------------------- |
| `id`         | `uuid` (UUIDv7)                      | all tables except §1.3 exceptions |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | all tables                        |
| `updated_at` | `timestamptz NOT NULL DEFAULT now()` | all **mutable** tables            |
| `deleted_at` | `timestamptz NULL`                   | soft-deleted tables only (§1.5)   |

Append-only tables (`follows`, `likes`, `piece_tags`, `reposts`, `responses`,
`audit_logs`, `analytics_events`, join rows in general) omit `updated_at`: their rows are
never mutated, only inserted and deleted. `claps` keeps `updated_at` because its `count`
is upserted.

All timestamps are `timestamptz` (UTC). `date` is used only where the domain is a calendar
day (`daily_prompts.active_on`, `analytics_daily.day`, `featured_writers.starts_on`).

### 1.5 Soft-delete policy

Soft delete (`deleted_at`, TypeORM `@DeleteDateColumn`) exists **only where the domain
needs recoverability**:

| Table         | Why soft delete                                                                                       |
| ------------- | ----------------------------------------------------------------------------------------------------- |
| `users`       | Account deactivation is reversible for a grace window; erasure is a separate hard-delete job          |
| `pieces`      | Writers delete work in frustration and ask for it back; also keeps engagement rows referentially sane |
| `collections` | Curated over months; accidental deletion must be recoverable                                          |

Everything else hard-deletes: a soft-deleted like is a contradiction, and half-dead join
rows poison every query with extra predicates.

**Uniqueness interacts with soft delete deliberately:**

- `users.username` and `users.email` are unique **including** soft-deleted rows (plain
  unique index, not partial). A permanent username is permanent — releasing it on delete
  invites impersonation. The GDPR erasure job rewrites `email` to a tombstone value.
- `pieces.slug` is unique including soft-deleted rows: URLs are forever; a restored piece
  gets its old URL back.

### 1.6 Migration policy

- Scaffolded with the TypeORM CLI so the filename prefix is a real `Date.now()` — a
  timestamp is **never hand-picked** (round/trailing-zero prefixes risk mis-ordering).
  The `.claude/hooks/guard-rules.sh` PostToolUse hook **hard-blocks** invented-timestamp
  migration files.
- **`migration:generate` is not usable in this codebase** (verified E6): entities carry plain
  FK columns with no relations (§16 §3.1), so generate reconciles by trying to **drop every
  foreign key**, and it also rewrites index/unique constraints and chokes on the raw-SQL
  generated `search_vector` columns (missing `typeorm_metadata`). Making it clean would mean
  adding relations + index/unique decorators to every entity, which the module-isolation rule
  forbids. So migrations here are **authored by hand on a CLI-stamped skeleton**:
  `pnpm --filter backend migration:create src/database/migrations/<Name>`, then write the DDL.
  (This is the "data-only / hand-authored exception" generalized to the whole schema for the
  documented architectural reason above.)
- Reviewed via `/migration-check` before merge; **immutable once merged** — fixes are new
  migrations (repo hook warns on edits to `src/migrations/*.ts`).
- Run as an explicit **deploy step**, never at app boot.
- Every migration is reversible (`down()` implemented) until it has run in production;
  destructive changes ship in two releases (expand → migrate data → contract).

### 1.7 Enum strategy

- **Native PG enums** for closed, stable domains: `piece_status`, `visibility`,
  `text_direction`, `repost_type`, `report_status`, `auth_provider`, `user_status`,
  `share_channel` (E7 — `internal | external | copy_link`).
  These change rarely; the DB-level guarantee is worth the `ALTER TYPE` on change.
- **`varchar` + TypeScript catalogue in `@qalam/shared`** for open sets that grow with the
  product: `notifications.type`, `analytics_events.event_type`, `audit_logs.action`,
  `reports.reason`. Adding a notification type must not require a migration.

### 1.8 Required extensions

```sql
CREATE EXTENSION IF NOT EXISTS citext;    -- case-insensitive email/username/slugs
CREATE EXTENSION IF NOT EXISTS unaccent;  -- diacritic folding for search
CREATE EXTENSION IF NOT EXISTS pg_trgm;   -- fuzzy match on usernames/titles
-- uuid-ossp deliberately NOT installed: UUIDv7 is generated by the application (§1.2)
```

---

## 2. ERD (grouped by domain)

```
╔═══ IDENTITY ═════════════════════════════════════════════════════════════════════╗
║  ┌─────────────────┐ N:1   ┌─────────┐  1:1   ┌──────────┐    N:1 ┌───────────┐  ║
║  │ auth_identities │──────▶│  users  │◀───────│ profiles │───────▶│ languages │  ║
║  └─────────────────┘       └────┬────┘        └──────────┘        │ (taxonomy)│  ║
║                                 │                                 └───────────┘  ║
╚═════════════════════════════════│════════════════════════════════════════════════╝
                                  │ author_id (1:N)
╔═══ CONTENT ══════════════════════▼═══════════════════════════════════════════════╗
║  ┌─────────────┐ 1:1  ┌────────┐  N:1  ┌───────────┐      ┌────────┐             ║
║  │ piece_stats │◀─────│ pieces │──────▶│ languages │      │ genres │◀── N:1      ║
║  └─────────────┘      └───┬────┘       └───────────┘      └────────┘             ║
║                           │ ▲                                                    ║
║        ┌──────────────────┘ └──────────────────┐                                 ║
║        │ piece_id (1:1)         parent_piece_id│ (N:1)                           ║
║        └─────────────▶ responses ◀─────────────┘   (a response IS a piece)       ║
╚══════════════════════════════════════════════════════════════════════════════════╝
╔═══ TAXONOMY ═════════════════════════════════════════════════════════════════════╗
║   pieces ◀──N:M──▶ tags        via  piece_tags (piece_id, tag_id)                ║
║   languages, genres            reference tables, seeded (§9)                     ║
╚══════════════════════════════════════════════════════════════════════════════════╝
╔═══ ENGAGEMENT ═══════════════════════════════════════════════════════════════════╗
║   users ──1:N──▶ likes      ◀──N:1── pieces      (unique user+piece)             ║
║   users ──1:N──▶ claps      ◀──N:1── pieces      (unique user+piece, count ≤ 50) ║
║   users ──1:N──▶ bookmarks  ◀──N:1── pieces      (unique user+piece)             ║
╚══════════════════════════════════════════════════════════════════════════════════╝
╔═══ CURATION ═════════════════════════════════════════════════════════════════════╗
║   users ─1:N─▶ collections   ─1:N─▶ collection_pieces   ◀─N:1─ pieces            ║
║   users ─1:N─▶ reading_lists ─1:N─▶ reading_list_pieces ◀─N:1─ pieces            ║
║   daily_prompts ──N:1──▶ languages          card_templates (standalone)          ║
║   featured_writers ──N:1──▶ users                                                ║
╚══════════════════════════════════════════════════════════════════════════════════╝
╔═══ SOCIAL GRAPH ═════════════════════════════════════════════════════════════════╗
║   users ◀──follower_id── follows ──followee_id──▶ users   (self-follow banned)   ║
║   users ──1:N──▶ reposts ◀──N:1── pieces   (type: repost | quote)                ║
╚══════════════════════════════════════════════════════════════════════════════════╝
╔═══ NOTIFICATIONS ════════════════════════════════════════════════════════════════╗
║   users(recipient) ◀──N:1── notifications ──N:1──▶ users(actor, nullable)        ║
║   polymorphic (entity_type, entity_id) → piece / user / …                        ║
╚══════════════════════════════════════════════════════════════════════════════════╝
╔═══ MODERATION / ADMIN ═══════════════════════════════════════════════════════════╗
║   users ◀─N:M─▶ roles   via user_roles         reports ──▶ (entity_type, id)     ║
║   audit_logs ──actor_id──▶ users (nullable)    append-only, no UPDATE/DELETE     ║
╚══════════════════════════════════════════════════════════════════════════════════╝
╔═══ ANALYTICS ════════════════════════════════════════════════════════════════════╗
║   analytics_events  (monthly partitions, no FKs — ingest hot path)               ║
║        └── BullMQ `analytics-rollup` ──▶ analytics_daily (piece/writer/platform) ║
╚══════════════════════════════════════════════════════════════════════════════════╝
```

---

## 3. Table catalogue

Every table from the ADR core list. **Base columns (§1.4) are omitted from the column
tables below** — which tables carry `updated_at` / `deleted_at` follows §1.4–1.5.

### 3.1 Identity

#### `users` (soft delete ✓)

| Column                                                                    | Type          | Null | Default    | Constraints / notes                                                                     |
| ------------------------------------------------------------------------- | ------------- | ---- | ---------- | --------------------------------------------------------------------------------------- |
| `id`                                                                      | `uuid`        | no   | app UUIDv7 | PK                                                                                      |
| `email`                                                                   | `citext`      | no   | —          | `uq_users_email`                                                                        |
| `email_verified_at`                                                       | `timestamptz` | yes  | `NULL`     | null = unverified                                                                       |
| `password_hash`                                                           | `text`        | yes  | `NULL`     | Argon2id; NULL = OAuth-only account                                                     |
| `username`                                                                | `citext`      | no   | —          | `uq_users_username`; `chk_users_username_format CHECK (username ~ '^[a-z0-9_]{3,30}$')` |
| `status`                                                                  | `user_status` | no   | `'active'` | `active \| suspended \| deactivated`                                                    |
| `last_login_at`                                                           | `timestamptz` | yes  | `NULL`     |                                                                                         |
| Indexes: `uq_users_email`, `uq_users_username`, `idx_users_username_trgm` |
| (`GIN (username gin_trgm_ops)` — fuzzy user search, §6.4).                |

FKs: none (root aggregate).

#### `auth_identities`

| Column             | Type            | Null | Default    | Constraints / notes                                                              |
| ------------------ | --------------- | ---- | ---------- | -------------------------------------------------------------------------------- |
| `id`               | `uuid`          | no   | app UUIDv7 | PK                                                                               |
| `user_id`          | `uuid`          | no   | —          | FK → `users` **ON DELETE CASCADE** (identity is meaningless without the account) |
| `provider`         | `auth_provider` | no   | —          | `google \| apple` (Apple deferred, enum ready)                                   |
| `provider_user_id` | `varchar(255)`  | no   | —          | provider's stable subject id                                                     |
| `email`            | `citext`        | yes  | `NULL`     | email as reported by provider (may drift from `users.email`)                     |

Constraints: `uq_auth_identities_provider_subject (provider, provider_user_id)`,
`uq_auth_identities_user_provider (user_id, provider)` — one identity per provider per user.

#### `verification_tokens` / `password_reset_tokens` (single-use, added in E1)

Short-lived, single-use auth tokens. Only the **SHA-256 hash** of the token is stored —
the raw token lives only in the emailed link (docs 13 §3, §13 redaction). Rotating
refresh tokens are **not** here (they are stateful in Redis DB 3, docs 13 §3.2); these two
are durable rows so a re-issue can invalidate prior tokens and issuance is auditable.

| Column       | Type          | Null | Default    | Constraints / notes                                        |
| ------------ | ------------- | ---- | ---------- | ---------------------------------------------------------- |
| `id`         | `uuid`        | no   | app UUIDv7 | PK                                                         |
| `user_id`    | `uuid`        | no   | —          | FK → `users` **ON DELETE CASCADE**                         |
| `token_hash` | `text`        | no   | —          | `uq_*_tokens_hash` — SHA-256 of the raw token, never plain |
| `expires_at` | `timestamptz` | no   | —          | 24 h (verification) / 60 min (reset)                       |
| `used_at`    | `timestamptz` | yes  | `NULL`     | non-null = consumed (single-use)                           |

Indexes: `idx_*_tokens_user (user_id)`. Both hard-delete (no recoverability need).

#### `profiles`

| Column                | Type           | Null | Default    | Constraints / notes                                                              |
| --------------------- | -------------- | ---- | ---------- | -------------------------------------------------------------------------------- |
| `id`                  | `uuid`         | no   | app UUIDv7 | PK                                                                               |
| `user_id`             | `uuid`         | no   | —          | FK → `users` **ON DELETE CASCADE**; `uq_profiles_user` (strict 1:1)              |
| `pen_name`            | `varchar(50)`  | no   | —          | the **single** pen name; changeable (unlike `username`)                          |
| `bio`                 | `varchar(500)` | yes  | `NULL`     |                                                                                  |
| `avatar_key`          | `text`         | yes  | `NULL`     | S3 object key, never a full URL (bucket/CDN may move)                            |
| `cover_key`           | `text`         | yes  | `NULL`     |                                                                                  |
| `website_url`         | `varchar(255)` | yes  | `NULL`     |                                                                                  |
| `location`            | `varchar(100)` | yes  | `NULL`     | free text                                                                        |
| `default_language_id` | `uuid`         | yes  | `NULL`     | FK → `languages` **ON DELETE SET NULL**; writer's default compose language       |
| `is_private`          | `boolean`      | no   | `false`    | private account; enforced in query-layer visibility guards, **not RLS** (ADR §4) |
| `followers_count`     | `integer`      | no   | `0`        | denormalized (§7)                                                                |
| `following_count`     | `integer`      | no   | `0`        | denormalized (§7)                                                                |
| `pieces_count`        | `integer`      | no   | `0`        | published pieces, denormalized (§7)                                              |

Why a separate table from `users`: credentials vs. presentation change at different rates,
and the hot auth path (`users`) stays narrow.

**E3 additions to `profiles`:** `social_links jsonb DEFAULT '{}'` (platform → url map) and a
generated `search_vector tsvector` over `pen_name` (A) + `bio` (B) via `immutable_unaccent`

- `simple` config (docs §6), with `idx_profiles_search` (GIN) and `idx_profiles_pen_name_trgm`
  (trigram) — search prep only, no search API yet. `idx_users_username_trgm` is also added.

**E3 new tables:**

- **`user_settings`** (1:1 satellite, PK = `user_id` → users CASCADE): `theme
theme_preference`, `default_piece_visibility visibility`, `notification_preferences jsonb`
  (schema now; sending is E9). Account privacy + compose language stay on `profiles`.
- **`profile_genres`** (pure join, PK `(profile_id, genre_id)`): a writer's selected genres.
  FKs `profile_id` → profiles CASCADE, `genre_id` → genres RESTRICT (reference data).

### 3.2 Content

#### `pieces` (soft delete ✓)

| Column                 | Type           | Null | Default                         | Constraints / notes                                                                                                                              |
| ---------------------- | -------------- | ---- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `id`                   | `uuid`         | no   | app UUIDv7                      | PK                                                                                                                                               |
| `author_id`            | `uuid`         | no   | —                               | FK → `users` **ON DELETE CASCADE** — fires only during hard erasure (users are soft-deleted otherwise); a piece without an author is meaningless |
| `title`                | `varchar(200)` | no   | `''`                            | drafts may be untitled                                                                                                                           |
| `subtitle`             | `varchar(300)` | yes  | `NULL`                          |                                                                                                                                                  |
| `slug`                 | `citext`       | yes  | `NULL`                          | NULL until first publish; `uq_pieces_slug` (plain unique — slug permanence, §1.5)                                                                |
| `content`              | `jsonb`        | no   | `'{"type":"doc","content":[]}'` | **canonical TipTap document** (§5)                                                                                                               |
| `content_text`         | `text`         | no   | `''`                            | derived plain text, feeds `search_vector`                                                                                                        |
| `featured_quote`       | `varchar(500)` | yes  | `NULL`                          | pull-quote for share cards                                                                                                                       |
| `cover_image_key`      | `text`         | yes  | `NULL`                          | S3 key                                                                                                                                           |
| `language_id`          | `uuid`         | no   | —                               | FK → `languages` **ON DELETE RESTRICT** — **one language per piece**, and a language with pieces can never be deleted                            |
| `genre_id`             | `uuid`         | yes  | `NULL`                          | FK → `genres` **ON DELETE RESTRICT**; required at publish (check below)                                                                          |
| `status`               | `piece_status` | no   | `'draft'`                       | `draft \| scheduled \| published \| archived`                                                                                                    |
| `visibility`           | `visibility`   | no   | `'public'`                      | `public \| unlisted \| private`                                                                                                                  |
| `scheduled_at`         | `timestamptz`  | yes  | `NULL`                          | see semantics below                                                                                                                              |
| `published_at`         | `timestamptz`  | yes  | `NULL`                          | set at **first** publish, never rewritten (feeds sort on it)                                                                                     |
| `word_count`           | `integer`      | no   | `0`                             | derived on write                                                                                                                                 |
| `reading_time_seconds` | `integer`      | no   | `0`                             | derived on write                                                                                                                                 |
| `search_vector`        | `tsvector`     | no   | generated                       | `GENERATED ALWAYS AS (…) STORED` (§6.2)                                                                                                          |
| Check constraints:     |

```sql
chk_pieces_scheduled  CHECK (status <> 'scheduled' OR scheduled_at IS NOT NULL)
chk_pieces_published  CHECK (status <> 'published'
                             OR (slug IS NOT NULL AND published_at IS NOT NULL
                                 AND genre_id IS NOT NULL))
```

**E4 additions to `pieces`** (implemented this epic): `archived_at timestamptz NULL` (set on
archive, cleared on unarchive) and `seo_metadata jsonb NULL` (`{ title?, description? }`).
`search_vector` (generated, docs §6.2) + `idx_pieces_search`/`idx_pieces_title_trgm` are
created now as search prep only — no search API until E8. Tags are get-or-created from
`#hashtags` on write; the `scheduled-publish` worker is deferred (schedule is stored only).

**`scheduled_at` semantics.** Set only while `status = 'scheduled'`; must be in the future
at scheduling time (service validates → `PIECE_SCHEDULE_IN_PAST`). The `scheduled-publish`
worker polls due rows (partial index below), flips `status → 'published'` and stamps
`published_at = now()`; `scheduled_at` is kept as an audit trace.

Indexes:

| Index                         | Definition                                                                                             | Serves                            |
| ----------------------------- | ------------------------------------------------------------------------------------------------------ | --------------------------------- |
| `uq_pieces_slug`              | `UNIQUE (slug)`                                                                                        | `GET /pieces/:slug`               |
| `idx_pieces_author_status`    | `(author_id, status, created_at DESC)`                                                                 | `/me/drafts`, author profile      |
| `idx_pieces_latest`           | `(published_at DESC, id DESC) WHERE status='published' AND visibility='public' AND deleted_at IS NULL` | Latest feed keyset pagination     |
| `idx_pieces_language`         | `(language_id, published_at DESC)`                                                                     | per-language browse/search filter |
| `idx_pieces_genre`            | `(genre_id, published_at DESC)`                                                                        | `/genre/:slug`                    |
| `idx_pieces_due`              | `(scheduled_at) WHERE status='scheduled'`                                                              | publish worker poll               |
| `idx_pieces_search`           | `GIN (search_vector)`                                                                                  | FTS (§6)                          |
| `idx_pieces_title_trgm`       | `GIN (title gin_trgm_ops)`                                                                             | fuzzy title search (§6.4)         |
| `idx_pieces_author_published` | `(author_id, published_at DESC) WHERE status='published' AND deleted_at IS NULL`                       | Following feed (E6)               |

#### `piece_stats` (1:1 satellite — PK is `piece_id`)

| Column                                                                                 | Type               | Null | Default | Constraints / notes                                                       |
| -------------------------------------------------------------------------------------- | ------------------ | ---- | ------- | ------------------------------------------------------------------------- |
| `piece_id`                                                                             | `uuid`             | no   | —       | PK; FK → `pieces` **ON DELETE CASCADE** (stats die with the piece)        |
| `views_count`                                                                          | `bigint`           | no   | `0`     |                                                                           |
| `reads_count`                                                                          | `bigint`           | no   | `0`     | read = ≥30 s dwell **and** ≥50 % scroll (event definition in `analytics`) |
| `likes_count`                                                                          | `integer`          | no   | `0`     |                                                                           |
| `claps_count`                                                                          | `integer`          | no   | `0`     | sum of `claps.count`                                                      |
| `bookmarks_count`                                                                      | `integer`          | no   | `0`     |                                                                           |
| `reposts_count`                                                                        | `integer`          | no   | `0`     | reposts + quotes                                                          |
| `responses_count`                                                                      | `integer`          | no   | `0`     |                                                                           |
| `shares_count`                                                                         | `integer`          | no   | `0`     | share-card / link shares                                                  |
| `trending_score`                                                                       | `double precision` | no   | `0`     | recomputed by `trending-score` queue                                      |
| Index: `idx_piece_stats_trending (trending_score DESC)` — backs the Trending feed tab. |
| Row is created in the same transaction as the piece. Maintenance rules in §7.          |

E6 additions: `idx_piece_stats_claps (claps_count DESC, piece_id DESC)` and
`idx_piece_stats_comments (comments_count DESC, piece_id DESC)` back the **most-clapped** and
**most-discussed** feed sorts (keyset: sort column + `piece_id` tiebreaker). `trending_score`
stays unused in E6 — trending is computed live + Redis-cached (no BullMQ job yet, ADR §10 E6
amendment).

#### `responses` (piece → piece; a response **is** a piece)

| Column                                                                                        | Type   | Null | Default    | Constraints / notes                                                                                                             |
| --------------------------------------------------------------------------------------------- | ------ | ---- | ---------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `id`                                                                                          | `uuid` | no   | app UUIDv7 | PK                                                                                                                              |
| `piece_id`                                                                                    | `uuid` | no   | —          | the response piece; FK → `pieces` **ON DELETE CASCADE**; `uq_responses_piece` (a piece responds to at most one parent)          |
| `parent_piece_id`                                                                             | `uuid` | no   | —          | FK → `pieces` **ON DELETE CASCADE** — the _link_ dies with the parent; the response piece itself survives as a standalone piece |
| Constraints: `chk_responses_not_self CHECK (piece_id <> parent_piece_id)`.                    |
| Index: `idx_responses_parent (parent_piece_id, created_at DESC)` — "responses to this piece". |
| Soft-deleted parents keep the link; visibility guards hide the thread head.                   |

### 3.3 Taxonomy

#### `languages`

| Column        | Type             | Null | Default    | Constraints / notes                                               |
| ------------- | ---------------- | ---- | ---------- | ----------------------------------------------------------------- |
| `id`          | `uuid`           | no   | app UUIDv7 | PK                                                                |
| `code`        | `varchar(10)`    | no   | —          | BCP-47; `uq_languages_code` (`hi`, `ur`, `en`, …)                 |
| `name_en`     | `varchar(80)`    | no   | —          | "Urdu"                                                            |
| `native_name` | `varchar(80)`    | no   | —          | "اردو"                                                            |
| `direction`   | `text_direction` | no   | `'ltr'`    | `ltr \| rtl` — drives `dir` attribute end-to-end                  |
| `script`      | `varchar(30)`    | yes  | `NULL`     | "Devanagari", "Nastaliq", "Latin" — drives reading-font selection |
| `is_active`   | `boolean`        | no   | `true`     | admin can stage languages before launch                           |
| `sort_order`  | `smallint`       | no   | `0`        |                                                                   |

Seeded (§9); admin-managed thereafter. Deletion is effectively banned by the RESTRICT FK
from `pieces` — deactivate instead.

#### `genres`

| Column        | Type           | Null | Default    | Constraints / notes                    |
| ------------- | -------------- | ---- | ---------- | -------------------------------------- |
| `id`          | `uuid`         | no   | app UUIDv7 | PK                                     |
| `slug`        | `citext`       | no   | —          | `uq_genres_slug`; route `/genre/:slug` |
| `name`        | `varchar(80)`  | no   | —          |                                        |
| `description` | `varchar(300)` | yes  | `NULL`     |                                        |
| `is_active`   | `boolean`      | no   | `true`     |                                        |
| `sort_order`  | `smallint`     | no   | `0`        |                                        |

RESTRICT FK from `pieces` — deactivate, never delete.

#### `tags`

| Column         | Type          | Null | Default    | Constraints / notes                                                     |
| -------------- | ------------- | ---- | ---------- | ----------------------------------------------------------------------- |
| `id`           | `uuid`        | no   | app UUIDv7 | PK                                                                      |
| `slug`         | `citext`      | no   | —          | `uq_tags_slug`; normalized (lowercased, unaccented); route `/tag/:slug` |
| `name`         | `varchar(60)` | no   | —          | display form as first typed                                             |
| `pieces_count` | `integer`     | no   | `0`        | denormalized usage count (tag pages, autocomplete rank)                 |

Index: `idx_tags_name_trgm GIN (name gin_trgm_ops)` — hashtag autocomplete.
Tags are user-created via `#hashtags` in the editor; get-or-create by `slug`.

#### `piece_tags` (pure join — composite PK)

| Column                                                                                     | Type   | Null | Default | Constraints / notes                 |
| ------------------------------------------------------------------------------------------ | ------ | ---- | ------- | ----------------------------------- |
| `piece_id`                                                                                 | `uuid` | no   | —       | FK → `pieces` **ON DELETE CASCADE** |
| `tag_id`                                                                                   | `uuid` | no   | —       | FK → `tags` **ON DELETE CASCADE**   |
| PK `(piece_id, tag_id)`. Index `idx_piece_tags_tag (tag_id, created_at DESC)` — tag pages. |
| Max tags per piece is a service-layer rule (`MAX_TAGS_PER_PIECE` in `@qalam/shared`) — a   |
| CHECK cannot count rows, and a trigger is not worth it.                                    |

### 3.4 Engagement

All three follow the same shape: unique `(user_id, piece_id)`, both FKs **ON DELETE
CASCADE** (an engagement row without either side is garbage), append-only except `claps`.

#### `likes`

| Column                                                                                     | Type   | Null | Default    | Constraints / notes   |
| ------------------------------------------------------------------------------------------ | ------ | ---- | ---------- | --------------------- |
| `id`                                                                                       | `uuid` | no   | app UUIDv7 | PK                    |
| `user_id`                                                                                  | `uuid` | no   | —          | FK → `users` CASCADE  |
| `piece_id`                                                                                 | `uuid` | no   | —          | FK → `pieces` CASCADE |
| `uq_likes_user_piece (user_id, piece_id)` · `idx_likes_piece (piece_id, created_at DESC)`. |

#### `claps` (capped at 50 per user per piece)

| Column     | Type       | Null | Default    | Constraints / notes                                    |
| ---------- | ---------- | ---- | ---------- | ------------------------------------------------------ |
| `id`       | `uuid`     | no   | app UUIDv7 | PK                                                     |
| `user_id`  | `uuid`     | no   | —          | FK → `users` CASCADE                                   |
| `piece_id` | `uuid`     | no   | —          | FK → `pieces` CASCADE                                  |
| `count`    | `smallint` | no   | `1`        | `chk_claps_count_range CHECK (count BETWEEN 1 AND 50)` |

`uq_claps_user_piece (user_id, piece_id)` — one **row** per user per piece holding the
running count. Cap constant: `MAX_CLAPS_PER_USER = 50` in `@qalam/shared`; the CHECK is
the database backstop. Canonical write path (single round trip, race-safe):

```sql
INSERT INTO claps (id, user_id, piece_id, count)
VALUES ($1, $2, $3, LEAST($4, 50))
ON CONFLICT (user_id, piece_id)
DO UPDATE SET count = LEAST(claps.count + EXCLUDED.count, 50),
              updated_at = now()
RETURNING count;
```

The service compares returned `count` to the previous value to know how many claps were
actually applied (delta feeds `piece_stats.claps_count` in the same transaction).

#### `bookmarks`

| Column                                                                                          | Type   | Null | Default    | Constraints / notes   |
| ----------------------------------------------------------------------------------------------- | ------ | ---- | ---------- | --------------------- |
| `id`                                                                                            | `uuid` | no   | app UUIDv7 | PK                    |
| `user_id`                                                                                       | `uuid` | no   | —          | FK → `users` CASCADE  |
| `piece_id`                                                                                      | `uuid` | no   | —          | FK → `pieces` CASCADE |
| `uq_bookmarks_user_piece (user_id, piece_id)` · `idx_bookmarks_user (user_id, created_at DESC)` |
| (bookmarks are private; the per-user listing is the only hot read).                             |

#### `comments` (soft delete ✓ — **net-new in E7**)

Not in the brief's original locked social list (ADR §10; 18 §risk-6 flagged comments as
scope creep) — added as a first-class Phase-1 engagement surface (recorded in ADR §10 E7
amendment). A **reply is a comment with a non-null `parent_id`** (adjacency list); no
separate reply table — that is the only model supporting arbitrary nesting to
`MAX_COMMENT_DEPTH = 3` (`@qalam/shared`).

| Column      | Type          | Null | Default    | Constraints / notes                                            |
| ----------- | ------------- | ---- | ---------- | -------------------------------------------------------------- |
| `id`        | `uuid`        | no   | app UUIDv7 | PK                                                             |
| `piece_id`  | `uuid`        | no   | —          | FK → `pieces` **ON DELETE CASCADE**                            |
| `author_id` | `uuid`        | no   | —          | FK → `users` **ON DELETE CASCADE**                             |
| `parent_id` | `uuid`        | yes  | `NULL`     | FK → `comments` **ON DELETE CASCADE**; NULL = top-level        |
| `depth`     | `smallint`    | no   | `1`        | 1 = top-level; reply = parent.depth + 1; capped at 3 (service) |
| `body`      | `text`        | no   | —          | 1..2000 chars (`COMMENT_MAX_LENGTH`)                           |
| `edited_at` | `timestamptz` | yes  | `NULL`     | last edit time (edit history); null until first edit           |

Soft-deletable (docs §1.5 recoverability is not the driver here; instead a deleted comment
keeps its node so the thread renders "This comment has been deleted." and its **replies
stay visible**). Indexes: `idx_comments_piece (piece_id, created_at)` ·
`idx_comments_parent (parent_id, created_at)` · `idx_comments_author (author_id)`.
Only the owner may edit; the owner **or a moderator+** may delete (soft). The comment count
lives on `piece_stats.comments_count` (added this epic) and is bumped transactionally on
create; a soft-deleted comment is NOT decremented (its tombstone still displays).

#### `shares` (append-only — **net-new table in E7**)

The brief listed `share`; this is the physical model. Phase 1 stores the **count only**
(`piece_stats.shares_count`) — no analytics dashboard. Each share appends a row and bumps
the counter transactionally.

| Column     | Type            | Null | Default    | Constraints / notes                                   |
| ---------- | --------------- | ---- | ---------- | ----------------------------------------------------- |
| `id`       | `uuid`          | no   | app UUIDv7 | PK                                                    |
| `user_id`  | `uuid`          | yes  | `NULL`     | FK → `users` **ON DELETE SET NULL**; null = anonymous |
| `piece_id` | `uuid`          | no   | —          | FK → `pieces` **ON DELETE CASCADE**                   |
| `channel`  | `share_channel` | no   | —          | `internal \| external \| copy_link`                   |

Index: `idx_shares_piece (piece_id, created_at DESC)`.

**E7 additions to existing tables:** `piece_stats.comments_count integer` (for the new
comments) and `collections.is_default boolean` (the auto-created "Favorites" collection —
partial unique `uq_collections_default (owner_id) WHERE is_default AND deleted_at IS NULL`,
mirroring `reading_lists.is_default`). `collections`'s owner-slug uniqueness is enforced
active-only (`WHERE deleted_at IS NULL`) so a soft-deleted collection frees its slug.

### 3.5 Curation

#### `collections` (soft delete ✓)

| Column            | Type           | Null | Default    | Constraints / notes                                                           |
| ----------------- | -------------- | ---- | ---------- | ----------------------------------------------------------------------------- |
| `id`              | `uuid`         | no   | app UUIDv7 | PK                                                                            |
| `owner_id`        | `uuid`         | no   | —          | FK → `users` **ON DELETE CASCADE** (hard erasure only)                        |
| `title`           | `varchar(150)` | no   | —          |                                                                               |
| `slug`            | `citext`       | no   | —          | `uq_collections_owner_slug (owner_id, slug)` — URL `/@user/collections/:slug` |
| `description`     | `varchar(500)` | yes  | `NULL`     |                                                                               |
| `cover_image_key` | `text`         | yes  | `NULL`     |                                                                               |
| `visibility`      | `visibility`   | no   | `'public'` | same enum as pieces                                                           |
| `pieces_count`    | `integer`      | no   | `0`        | denormalized (§7)                                                             |

#### `collection_pieces`

| Column                                                                                 | Type           | Null | Default    | Constraints / notes                      |
| -------------------------------------------------------------------------------------- | -------------- | ---- | ---------- | ---------------------------------------- |
| `id`                                                                                   | `uuid`         | no   | app UUIDv7 | PK                                       |
| `collection_id`                                                                        | `uuid`         | no   | —          | FK → `collections` **ON DELETE CASCADE** |
| `piece_id`                                                                             | `uuid`         | no   | —          | FK → `pieces` **ON DELETE CASCADE**      |
| `position`                                                                             | `integer`      | no   | `0`        | curator-defined order                    |
| `note`                                                                                 | `varchar(300)` | yes  | `NULL`     | curator's note on the entry              |
| `uq_collection_pieces (collection_id, piece_id)` · `idx_collection_pieces_pos          |
| (collection_id, position)`. Carries payload (`position`, `note`), hence a surrogate id |
| rather than the pure-join composite-PK form.                                           |

#### `reading_lists` (private to owner — no `visibility` column by design)

| Column       | Type           | Null | Default    | Constraints / notes                                   |
| ------------ | -------------- | ---- | ---------- | ----------------------------------------------------- |
| `id`         | `uuid`         | no   | app UUIDv7 | PK                                                    |
| `owner_id`   | `uuid`         | no   | —          | FK → `users` **ON DELETE CASCADE**                    |
| `title`      | `varchar(150)` | no   | —          | `uq_reading_lists_owner_title (owner_id, title)`      |
| `is_default` | `boolean`      | no   | `false`    | every user gets a default "Read Later" list at signup |

Partial unique: `uq_reading_lists_default ON (owner_id) WHERE is_default` — exactly one
default per user. **Why separate from collections:** collections are public showcases;
reading lists are private queues. One flag-ridden table would be all special cases.

#### `reading_list_pieces`

| Column                                                | Type          | Null | Default    | Constraints / notes                        |
| ----------------------------------------------------- | ------------- | ---- | ---------- | ------------------------------------------ |
| `id`                                                  | `uuid`        | no   | app UUIDv7 | PK                                         |
| `reading_list_id`                                     | `uuid`        | no   | —          | FK → `reading_lists` **ON DELETE CASCADE** |
| `piece_id`                                            | `uuid`        | no   | —          | FK → `pieces` **ON DELETE CASCADE**        |
| `position`                                            | `integer`     | no   | `0`        |                                            |
| `read_at`                                             | `timestamptz` | yes  | `NULL`     | mark-as-read within the list               |
| `uq_reading_list_pieces (reading_list_id, piece_id)`. |

#### `daily_prompts`

| Column        | Type           | Null | Default    | Constraints / notes                                                    |
| ------------- | -------------- | ---- | ---------- | ---------------------------------------------------------------------- |
| `id`          | `uuid`         | no   | app UUIDv7 | PK                                                                     |
| `prompt`      | `varchar(500)` | no   | —          | the writing prompt text                                                |
| `language_id` | `uuid`         | yes  | `NULL`     | FK → `languages` **ON DELETE SET NULL**; NULL = all languages          |
| `active_on`   | `date`         | no   | —          | the day it is featured                                                 |
| `created_by`  | `uuid`         | yes  | `NULL`     | FK → `users` **ON DELETE SET NULL** (prompt outlives its admin author) |
| `is_active`   | `boolean`      | no   | `true`     |                                                                        |

Unique: `UNIQUE NULLS NOT DISTINCT (active_on, language_id)` (PG16) — one prompt per day
per language, and one global prompt per day.

#### `card_templates` (share-card designs, admin-managed)

| Column              | Type           | Null | Default    | Constraints / notes                                                                                        |
| ------------------- | -------------- | ---- | ---------- | ---------------------------------------------------------------------------------------------------------- |
| `id`                | `uuid`         | no   | app UUIDv7 | PK                                                                                                         |
| `name`              | `varchar(100)` | no   | —          |                                                                                                            |
| `slug`              | `citext`       | no   | —          | `uq_card_templates_slug`                                                                                   |
| `config`            | `jsonb`        | no   | —          | layout/typography/color tokens consumed by the card renderer; schema validated by Zod in the admin service |
| `preview_image_key` | `text`         | yes  | `NULL`     |                                                                                                            |
| `is_active`         | `boolean`      | no   | `true`     |                                                                                                            |
| `sort_order`        | `smallint`     | no   | `0`        |                                                                                                            |

#### `featured_writers`

| Column       | Type           | Null | Default    | Constraints / notes                 |
| ------------ | -------------- | ---- | ---------- | ----------------------------------- |
| `id`         | `uuid`         | no   | app UUIDv7 | PK                                  |
| `user_id`    | `uuid`         | no   | —          | FK → `users` **ON DELETE CASCADE**  |
| `curated_by` | `uuid`         | yes  | `NULL`     | FK → `users` **ON DELETE SET NULL** |
| `blurb`      | `varchar(300)` | yes  | `NULL`     | editorial one-liner                 |
| `starts_on`  | `date`         | no   | —          |                                     |
| `ends_on`    | `date`         | yes  | `NULL`     | NULL = until replaced               |
| `position`   | `smallint`     | no   | `0`        | ordering within the featured rail   |

`uq_featured_writers (user_id, starts_on)` ·
`chk_featured_window CHECK (ends_on IS NULL OR ends_on > starts_on)` ·
`idx_featured_active (starts_on, ends_on)`.

### 3.6 Social graph

#### `follows`

**E3 update:** the anticipated pending flag is now live — `status follow_status
('pending' | 'accepted')` was added (default `accepted`); a `pending` row is a follow
request awaiting a private account's approval. This makes `follows` mutable, so it also
gains `updated_at`. Index `idx_follows_pending (followee_id, status)` serves the
incoming-request queue.

| Column                                                                                    | Type            | Null | Default      | Constraints / notes                    |
| ----------------------------------------------------------------------------------------- | --------------- | ---- | ------------ | -------------------------------------- |
| `id`                                                                                      | `uuid`          | no   | app UUIDv7   | PK                                     |
| `follower_id`                                                                             | `uuid`          | no   | —            | FK → `users` **ON DELETE CASCADE**     |
| `followee_id`                                                                             | `uuid`          | no   | —            | FK → `users` **ON DELETE CASCADE**     |
| `status`                                                                                  | `follow_status` | no   | `'accepted'` | `pending` (request) \| `accepted` (E3) |
| `uq_follows (follower_id, followee_id)` · `chk_follows_not_self                           |
| CHECK (follower_id <> followee_id)`·`idx_follows_followee (followee_id, created_at DESC)` |
| (followers list + Following-feed fan-in). Private-account follow _requests_ are a Phase 1 |
| service concern layered on this table (a pending flag would go here if approved-follows   |
| ship; not added until the product needs it).                                              |

#### `reposts`

| Column       | Type           | Null | Default    | Constraints / notes                                                   |
| ------------ | -------------- | ---- | ---------- | --------------------------------------------------------------------- |
| `id`         | `uuid`         | no   | app UUIDv7 | PK                                                                    |
| `user_id`    | `uuid`         | no   | —          | FK → `users` **ON DELETE CASCADE**                                    |
| `piece_id`   | `uuid`         | no   | —          | FK → `pieces` **ON DELETE CASCADE**                                   |
| `type`       | `repost_type`  | no   | `'repost'` | `repost \| quote`                                                     |
| `quote_text` | `varchar(500)` | yes  | `NULL`     | `chk_reposts_quote CHECK (type <> 'quote' OR quote_text IS NOT NULL)` |

Partial unique: `uq_reposts_plain ON (user_id, piece_id) WHERE type = 'repost'` — one
plain repost per user per piece; multiple quotes allowed (each is distinct commentary).
Rows are immutable (edit = delete + recreate).
Index: `idx_reposts_user (user_id, created_at DESC)` — profile activity + Following feed.

### 3.7 Notifications

#### `notifications` (in-app only — ADR locked)

| Column                                                                                    | Type          | Null | Default    | Constraints / notes                                                                                                                               |
| ----------------------------------------------------------------------------------------- | ------------- | ---- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                                                                                      | `uuid`        | no   | app UUIDv7 | PK                                                                                                                                                |
| `recipient_id`                                                                            | `uuid`        | no   | —          | FK → `users` **ON DELETE CASCADE**                                                                                                                |
| `actor_id`                                                                                | `uuid`        | yes  | `NULL`     | FK → `users` **ON DELETE SET NULL** — system notifications have no actor; erased actors don't destroy the recipient's history                     |
| `type`                                                                                    | `varchar(40)` | no   | —          | open catalogue in `@qalam/shared`: `follow`, `like`, `clap`, `repost`, `quote`, `response`, `mention`, `follower_published`, `featured`, `system` |
| `entity_type`                                                                             | `varchar(30)` | yes  | `NULL`     | polymorphic pointer (`piece`, `user`, …)                                                                                                          |
| `entity_id`                                                                               | `uuid`        | yes  | `NULL`     |                                                                                                                                                   |
| `data`                                                                                    | `jsonb`       | no   | `'{}'`     | denormalized render payload (piece title/slug, actor username _at emit time_) so listing never joins                                              |
| `read_at`                                                                                 | `timestamptz` | yes  | `NULL`     |                                                                                                                                                   |
| Indexes: `idx_notifications_inbox (recipient_id, created_at DESC)` · partial              |
| `idx_notifications_unread (recipient_id) WHERE read_at IS NULL` (unread badge counts this |
| index only; cached in Redis, displayed capped "99+"). Written by the `notifications`      |
| queue, never inline in request handlers; pruned after 12 months.                          |

### 3.8 Moderation / Admin

#### `reports`

| Column            | Type            | Null | Default    | Constraints / notes                                                                           |
| ----------------- | --------------- | ---- | ---------- | --------------------------------------------------------------------------------------------- |
| `id`              | `uuid`          | no   | app UUIDv7 | PK                                                                                            |
| `reporter_id`     | `uuid`          | yes  | `NULL`     | FK → `users` **ON DELETE SET NULL** — the report must outlive the reporter                    |
| `entity_type`     | `varchar(20)`   | no   | —          | `chk_reports_entity CHECK (entity_type IN ('piece','user'))`                                  |
| `entity_id`       | `uuid`          | no   | —          | no FK (polymorphic); existence validated in service                                           |
| `reason`          | `varchar(40)`   | no   | —          | catalogue: `spam`, `plagiarism`, `harassment`, `hate`, `sexual_content`, `self_harm`, `other` |
| `details`         | `varchar(1000)` | yes  | `NULL`     |                                                                                               |
| `status`          | `report_status` | no   | `'open'`   | `open \| in_review \| resolved \| dismissed`                                                  |
| `resolved_by`     | `uuid`          | yes  | `NULL`     | FK → `users` **ON DELETE SET NULL**                                                           |
| `resolved_at`     | `timestamptz`   | yes  | `NULL`     |                                                                                               |
| `resolution_note` | `varchar(1000)` | yes  | `NULL`     |                                                                                               |

Indexes: `idx_reports_queue (status, created_at)` · `idx_reports_entity (entity_type, entity_id)`
(dedupe/aggregate reports against the same target).

#### `roles` (seeded, §9)

| Column        | Type           | Null | Default    | Constraints / notes                                                                                                   |
| ------------- | -------------- | ---- | ---------- | --------------------------------------------------------------------------------------------------------------------- |
| `id`          | `uuid`         | no   | app UUIDv7 | PK                                                                                                                    |
| `name`        | `citext`       | no   | —          | `uq_roles_name`: `user`, `moderator`, `admin`, `super_admin`                                                          |
| `rank`        | `smallint`     | no   | —          | `uq_roles_rank`; hierarchy `user(0) < moderator(50) < admin(80) < super_admin(100)` — guards compare ranks, not names |
| `description` | `varchar(200)` | yes  | `NULL`     |                                                                                                                       |

#### `user_roles` (pure join — composite PK)

| Column                                                                                    | Type   | Null | Default | Constraints / notes                                                                                                      |
| ----------------------------------------------------------------------------------------- | ------ | ---- | ------- | ------------------------------------------------------------------------------------------------------------------------ |
| `user_id`                                                                                 | `uuid` | no   | —       | FK → `users` **ON DELETE CASCADE**                                                                                       |
| `role_id`                                                                                 | `uuid` | no   | —       | FK → `roles` **ON DELETE RESTRICT** — roles are seed data; deleting one with assignments would silently strip privileges |
| `granted_by`                                                                              | `uuid` | yes  | `NULL`  | FK → `users` **ON DELETE SET NULL**                                                                                      |
| PK `(user_id, role_id)`. The base `user` role is implicit (every account has it);         |
| `user_roles` stores only elevated grants — keeps the table tiny and the RBAC guard cheap. |

#### `audit_logs` (append-only)

| Column        | Type           | Null | Default    | Constraints / notes                                                                    |
| ------------- | -------------- | ---- | ---------- | -------------------------------------------------------------------------------------- |
| `id`          | `uuid`         | no   | app UUIDv7 | PK                                                                                     |
| `actor_id`    | `uuid`         | yes  | `NULL`     | FK → `users` **ON DELETE SET NULL** — the log survives the admin                       |
| `action`      | `varchar(100)` | no   | —          | dotted catalogue: `user.suspend`, `piece.unpublish`, `report.resolve`, `role.grant`, … |
| `entity_type` | `varchar(30)`  | yes  | `NULL`     |                                                                                        |
| `entity_id`   | `uuid`         | yes  | `NULL`     |                                                                                        |
| `changes`     | `jsonb`        | yes  | `NULL`     | `{ "before": {…}, "after": {…} }` diff of mutated fields                               |
| `metadata`    | `jsonb`        | no   | `'{}'`     | ip, user-agent                                                                         |
| `request_id`  | `uuid`         | yes  | `NULL`     | correlates with API logs (X-Request-Id)                                                |

Immutability enforced twice: the app role gets `GRANT INSERT, SELECT` only, plus a
trigger that raises on UPDATE/DELETE. Every admin mutation writes here in the **same
transaction** as the mutation (ADR §8). Indexes: `idx_audit_actor (actor_id, created_at
DESC)` · `idx_audit_entity (entity_type, entity_id, created_at DESC)`.

#### `settings` (E12.8 — generic key-value configuration store)

| Column              | Type           | Null | Default    | Constraints / notes                                                               |
| ------------------- | -------------- | ---- | ---------- | --------------------------------------------------------------------------------- |
| `id`                | `uuid`         | no   | app UUIDv7 | PK                                                                                |
| `key`               | `varchar(120)` | no   | —          | `uq_settings_key` — dot-cased, e.g. `platform.name`, `auth.registration.enabled`  |
| `category`          | `varchar(40)`  | no   | —          | grouping bucket (`general`, `security`, `content`, … — open set, code catalogue)  |
| `value`             | `jsonb`        | no   | —          | polymorphic current value (boolean/number/string/array/object)                    |
| `data_type`         | `varchar(20)`  | no   | —          | `boolean \| string \| number \| json \| array \| enum` — how `value` is validated |
| `default_value`     | `jsonb`        | no   | —          | catalogue default the value resets to                                             |
| `validation_rules`  | `jsonb`        | no   | `'{}'`     | type-specific constraints (min/max/enum/regex/maxLength)                          |
| `description`       | `text`         | no   | `''`       |                                                                                   |
| `editable`          | `boolean`      | no   | `true`     | `false` = infra-managed (env-driven), rejected by the service                     |
| `environment_scope` | `varchar(20)`  | no   | `'all'`    | `all \| production \| staging \| development`                                     |
| `updated_by`        | `uuid`         | yes  | `NULL`     | no FK (config outlives the admin, cf. `audit_logs`); null while at the default    |

No soft-delete (config is not a recoverability domain, §1.5). Rows are **seeded on boot**
from a TypeScript catalogue (idempotent insert-missing) — a new setting is a new ROW, never a
new column, so AI/Payments/Mobile/Creator-Economy config lands additively without a migration
(§1.7). Index: `idx_settings_category (category)`. Every mutation is audited (`setting.update`)
and cache-invalidated (Redis DB 0). Maintenance mode is the `maintenance.*` rows — no separate
table.

#### `feature_flags` (E12.8 — per-flag rollout model)

| Column               | Type           | Null | Default    | Constraints / notes                                |
| -------------------- | -------------- | ---- | ---------- | -------------------------------------------------- |
| `id`                 | `uuid`         | no   | app UUIDv7 | PK                                                 |
| `key`                | `varchar(120)` | no   | —          | `uq_feature_flags_key` — e.g. `feature.ai.enabled` |
| `enabled`            | `boolean`      | no   | `false`    | master switch                                      |
| `rollout_percentage` | `int`          | no   | `0`        | 0–100 staged exposure                              |
| `environment`        | `varchar(20)`  | no   | `'all'`    | `all \| production \| staging \| development`      |
| `description`        | `text`         | no   | `''`       |                                                    |
| `updated_by`         | `uuid`         | yes  | `NULL`     | no FK                                              |

Seeded on boot with the Phase-2+ capabilities (AI, Payments, Mobile, Creator Economy) as
disabled flags. Index: `idx_feature_flags_enabled (enabled)`. Mutations audited
(`feature_flag.create|update|delete`) and cache-invalidated.

### 3.9 Analytics

#### `analytics_events` (partitioned, append-only, **no FKs**)

```sql
CREATE TABLE analytics_events (
  id            uuid        NOT NULL,             -- app UUIDv7
  event_type    varchar(40) NOT NULL,             -- 'piece.view', 'piece.read',
                                                  -- 'piece.read_progress', 'piece.share',
                                                  -- 'profile.view', 'search.query', …
  user_id       uuid,                             -- NULL for anonymous readers
  anonymous_id  varchar(64),                      -- cookie/device id when user_id IS NULL
  session_id    uuid,
  piece_id      uuid,
  country_code  char(2),                          -- explicit columns for the rollup
  device_type   varchar(16),                      -- 'desktop' | 'mobile' | 'tablet'
  referrer_host varchar(255),
  properties    jsonb       NOT NULL DEFAULT '{}',-- progress pct, read seconds, tab, …
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, created_at)                    -- partition key must be in the PK
) PARTITION BY RANGE (created_at);

-- one partition per month, e.g.:
CREATE TABLE analytics_events_y2026m07 PARTITION OF analytics_events
  FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
```

**Why no FKs here:** this is the ingest hot path; FK checks buy integrity we don't need
on disposable telemetry, and 13-month retention drops make dangling refs a non-issue.

Per-partition indexes: `(piece_id, created_at)` · `(event_type, created_at)` ·
`BRIN (created_at)` (append-only order makes BRIN nearly free).

**Lifecycle** (repeatable jobs on the `analytics-rollup` queue):

1. _Monthly maintenance_ — creates the next 3 monthly partitions ahead of time.
2. _Nightly rollup_ — aggregates yesterday into `analytics_daily` (idempotent upsert;
   re-running a day overwrites it).
3. _Retention_ — `DETACH` + `DROP` partitions older than **13 months** (13, not 12: every
   month keeps a full year-over-year comparison window).

#### `analytics_daily` (rollup aggregates, kept indefinitely — it stays small)

| Column             | Type          | Null | Default    | Constraints / notes                                                                                                                                                        |
| ------------------ | ------------- | ---- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`               | `uuid`        | no   | app UUIDv7 | PK                                                                                                                                                                         |
| `day`              | `date`        | no   | —          |                                                                                                                                                                            |
| `entity_type`      | `varchar(20)` | no   | —          | `chk_ad_entity CHECK (entity_type IN ('piece','writer','platform'))`                                                                                                       |
| `entity_id`        | `uuid`        | yes  | `NULL`     | NULL for `platform` rows; no FK (subject may be pruned/erased; history remains)                                                                                            |
| `views`            | `bigint`      | no   | `0`        |                                                                                                                                                                            |
| `reads`            | `bigint`      | no   | `0`        |                                                                                                                                                                            |
| `read_seconds`     | `bigint`      | no   | `0`        |                                                                                                                                                                            |
| `completions`      | `bigint`      | no   | `0`        | completion rate = completions / views, computed at read time                                                                                                               |
| `shares`           | `bigint`      | no   | `0`        |                                                                                                                                                                            |
| `likes`            | `integer`     | no   | `0`        |                                                                                                                                                                            |
| `claps`            | `integer`     | no   | `0`        |                                                                                                                                                                            |
| `followers_gained` | `integer`     | no   | `0`        | writer/platform rows only                                                                                                                                                  |
| `breakdowns`       | `jsonb`       | no   | `'{}'`     | `{ "country": {"IN": 812, …}, "device": {…}, "referrer": {…} }` — brief requires countries/devices/traffic; jsonb keeps the row wide-enough without a dimensions explosion |

Unique: `UNIQUE NULLS NOT DISTINCT (day, entity_type, entity_id)` — the rollup's upsert
target. Index: `idx_analytics_daily_entity (entity_type, entity_id, day DESC)` — powers
`/me/stats` charts and admin analytics.

---

## 4. Domain rules encoded in schema

| Rule                                 | DB mechanism                                                           | Service mechanism                                                           |
| ------------------------------------ | ---------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Permanent username                   | `citext` unique, format CHECK; unique spans soft-deleted rows          | Update DTO has no `username` field; repository never writes it after INSERT |
| Username immutable (belt-and-braces) | Optional trigger, below                                                | `USER_USERNAME_IMMUTABLE` error if attempted via any path                   |
| Single pen name                      | one `pen_name` column on `profiles` (1:1) — the schema cannot hold two | changeable via profile update                                               |
| One language per piece               | `pieces.language_id NOT NULL` FK, RESTRICT                             | language locked after publish (service rule)                                |
| Claps ≤ 50/user/piece                | `CHECK (count BETWEEN 1 AND 50)` + unique `(user_id, piece_id)`        | `LEAST(…, 50)` upsert (§3.4); constant from `@qalam/shared`                 |
| Publish invariants                   | `chk_pieces_published` (slug, published_at, genre required)            | preview → publish flow validates everything first                           |
| No self-follow / self-response       | CHECKs on `follows`, `responses`                                       | friendly 422 before the DB ever sees it                                     |
| Private accounts                     | none (deliberately — ADR: no RLS)                                      | visibility guards in repositories; every piece/profile query is scoped      |

Username-immutability trigger (optional hardening; migrations include it, and it costs one
comparison per rare `users` UPDATE):

```sql
CREATE FUNCTION users_username_immutable() RETURNS trigger AS $$
BEGIN
  IF NEW.username IS DISTINCT FROM OLD.username THEN
    RAISE EXCEPTION 'username is immutable' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_username_immutable
  BEFORE UPDATE OF username ON users
  FOR EACH ROW EXECUTE FUNCTION users_username_immutable();
```

---

## 5. Content storage

- **`pieces.content` (jsonb) is the single source of truth** — the TipTap document as the
  editor produced it: marks (bold/italic/underline/align/blockquote/lists) and custom
  nodes (footnotes, mentions, hashtags) survive round-trips losslessly.
- **HTML is never stored.** Why: HTML is a _rendering_ of the document, and renderings
  rot — every editor upgrade, sanitizer fix, or design change would leave stale HTML in
  the database (and stored HTML is a persistent-XSS liability). Web and Flutter render
  from JSON with their own renderers; the JSON is what both can consume.
- **Derived columns, recomputed on every content write** (same transaction, in the
  service via `@qalam/utils`):
  - `content_text` — flattened plain text; the only input FTS sees.
  - `word_count` — script-aware token count (whitespace-delimited for Latin/Devanagari;
    Urdu counted after NFC normalization).
  - `reading_time_seconds` — words ÷ per-script WPM constants from `@qalam/shared`.
- Media inside content (cover, inline images) is referenced by **S3 object key**, resolved
  to CDN URLs at render time — buckets and CDNs can move without a data migration.

---

## 6. Full-text search

### 6.1 The honest position

PostgreSQL has **no stemmers for Hindi or Urdu** — there is no `hindi` or `urdu` FTS
config, and pretending with `english` would actively corrupt matching. So:

- FTS config is **`'simple'`** — pure tokenization, no stemming, no stop words. Matching
  is exact-token: "لکھنا" matches "لکھنا"; morphological variants do not match. That is
  the correct behavior available, stated honestly — trigram fuzziness compensates (§6.4).
- `unaccent` folds Latin diacritics; it does little for Devanagari/Nastaliq — its value
  is the English/global growth path. Urdu/Hindi text is **NFC-normalized in the app
  before write** (ZWNJ/ZWJ and diacritic variance is an input problem, not search-time).

### 6.2 Schema

`unaccent()` is only STABLE, so it cannot appear in a generated column directly; a
one-line IMMUTABLE wrapper (safe because we never edit the unaccent dictionary) fixes that:

```sql
CREATE FUNCTION immutable_unaccent(text) RETURNS text AS
  $$ SELECT public.unaccent('public.unaccent', $1) $$
  LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT;

ALTER TABLE pieces ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', immutable_unaccent(coalesce(title, ''))),        'A') ||
    setweight(to_tsvector('simple', immutable_unaccent(coalesce(subtitle, ''))),     'B') ||
    setweight(to_tsvector('simple', immutable_unaccent(coalesce(content_text, ''))), 'C')
  ) STORED;

CREATE INDEX idx_pieces_search ON pieces USING GIN (search_vector);
```

Tags are not in the vector (a generated column cannot join); tag search goes through
`tags.slug` / `piece_tags` directly — which is also what users expect from `#tag` queries.

### 6.3 Query pattern

```sql
SELECT p.*, ts_rank(p.search_vector, q) AS rank
FROM pieces p,
     websearch_to_tsquery('simple', immutable_unaccent($1)) q
WHERE p.search_vector @@ q
  AND p.status = 'published' AND p.visibility = 'public' AND p.deleted_at IS NULL
  AND ($2::uuid IS NULL OR p.language_id = $2)      -- per-language search
ORDER BY rank DESC, p.published_at DESC
LIMIT $3;
```

`websearch_to_tsquery` because it never throws on user input (quotes, `-exclusion`, `OR`
all parse safely) — raw `to_tsquery` on user input is a 500 waiting to happen.
**Per-language behavior:** search defaults to the user's content-language filter; results
are always filterable by `language`, `genre`, `tag`, matching the brief's search axes.

### 6.4 Fuzzy layer — `pg_trgm`

Exact-token FTS misses typos and partial names, so usernames/pen names and titles get
trigram GIN indexes (`idx_users_username_trgm`, `idx_pieces_title_trgm`, `idx_tags_name_trgm`):

```sql
SELECT username, similarity(username, $1) AS sim
FROM users
WHERE username % $1              -- trigram similarity over threshold
ORDER BY sim DESC LIMIT 10;
```

Writer search runs FTS and trigram in parallel and merges (exact matches first).

### 6.5 The escape hatch

Everything above sits behind `SearchService` (its own module — an ADR-designated
extraction seam). If relevance or scale outgrows Postgres, **Meilisearch** is the
designated successor (not Elasticsearch — too heavy for this team): an indexer worker +
a new `SearchService` implementation; no schema change, no API change.

---

## 7. Counters — `piece_stats` and friends

**`COUNT(*)` is banned on hot paths.** Why: counting is O(rows) under MVCC — Postgres must
walk visible tuples every time. The hottest pieces would have the most expensive counts,
i.e. cost grows exactly where traffic does. Reads must be O(1).

Denormalized counters and where they live:

| Counter                                                    | Lives on      | Source of truth                                                           |
| ---------------------------------------------------------- | ------------- | ------------------------------------------------------------------------- |
| likes/claps/bookmarks/reposts/responses/shares/views/reads | `piece_stats` | `likes`, `claps`, `bookmarks`, `reposts`, `responses`, `analytics_events` |
| `followers_count`, `following_count`, `pieces_count`       | `profiles`    | `follows`, `pieces`                                                       |
| `pieces_count` per tag                                     | `tags`        | `piece_tags`                                                              |

**Maintenance — three layers:**

1. **Transactional.** The engagement write and the counter bump commit atomically:
   ```sql
   -- same transaction as the INSERT INTO likes …
   UPDATE piece_stats SET likes_count = likes_count + 1, updated_at = now()
   WHERE piece_id = $1;
   ```
   Single-row relative `UPDATE`, no read-modify-write — no lost updates. Row-lock
   contention on viral pieces is accepted at Phase 1 scale (views/reads, the truly
   high-frequency counters, arrive via the analytics pipeline, not per-request).
2. **Nightly reconciliation** (repeatable job, `analytics-rollup` queue): recompute each
   counter from its source table (`COUNT` is allowed here — batch job at 04:00) and fix
   drifted rows. Drift is logged and alarmed; persistent drift = a code path forgot layer 1.
3. **`trending_score`** — recomputed by the `trending-score` queue (time-decayed
   engagement), read via `idx_piece_stats_trending`.

---

## 8. TypeORM specifics

- `SnakeNamingStrategy` global; entity properties stay camelCase in TS.
- `synchronize: false` **always** — including tests (Testcontainers run migrations).
- Soft delete via `@DeleteDateColumn`; raw QueryBuilder in repositories must add
  `deleted_at IS NULL` explicitly (review checklist item).
- UUIDv7 generated in `BaseEntity` `@BeforeInsert` (`uuidv7()` via `@qalam/utils`) —
  entities never rely on DB defaults for identity.
- `analytics_events` partitions are DDL-managed (migrations + maintenance job); TypeORM
  maps the parent table only.

---

## 9. Seed strategy

Seeds live in `backend/src/database/seeds/`, are **idempotent upserts by natural key**
(`code`, `slug`, `name`), and run as a deploy step _after_ migrations. Re-running is safe;
seeds never overwrite admin edits (insert-if-missing, not sync).

**`languages`:**

| code | name_en | native_name | direction | script     |
| ---- | ------- | ----------- | --------- | ---------- |
| `hi` | Hindi   | हिन्दी      | `ltr`     | Devanagari |
| `ur` | Urdu    | اردو        | **`rtl`** | Nastaliq   |
| `en` | English | English     | `ltr`     | Latin      |

**`genres`** (starter set for the launch audience; admin-extendable):
`poetry`, `ghazal`, `nazm`, `short-story`, `flash-fiction`, `essay`, `memoir`, `letter`.

**`roles`:** `user` (rank 0), `moderator` (50), `admin` (80), `super_admin` (100).

**Bootstrap super-admin.** The seed runner creates the first `super_admin` account
(`super-admin.seed.ts`, run last so the roles above exist to grant). Credentials come
from env — `SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_USERNAME`, `SUPER_ADMIN_PASSWORD` — never
hard-coded; the password is argon2id-hashed with the same policy as registration (via
the auth `PasswordService`), the account is created pre-verified + active, and the
`super_admin` role is granted in one transaction. It is **idempotent** (an existing email
only has its role ensured — a rotated password is never reset) and **production-safe**: in
`production` a missing env var skips the step with a warning (no default-credential admin
ever lands in prod), while non-production falls back to documented dev defaults
(`admin@qalam.local` / `superadmin`) with a change-me warning.

---

## 10. ON DELETE quick reference

| Relation                                                               | Rule       | One-line reason                                     |
| ---------------------------------------------------------------------- | ---------- | --------------------------------------------------- |
| `auth_identities.user_id` → users                                      | CASCADE    | identity meaningless without account                |
| `profiles.user_id` → users                                             | CASCADE    | strict 1:1 satellite                                |
| `pieces.author_id` → users                                             | CASCADE    | fires only on hard erasure; orphan pieces are worse |
| `pieces.language_id` → languages                                       | RESTRICT   | reference data; deactivate instead                  |
| `pieces.genre_id` → genres                                             | RESTRICT   | reference data; deactivate instead                  |
| `piece_stats.piece_id` → pieces                                        | CASCADE    | satellite                                           |
| `responses.*` → pieces                                                 | CASCADE    | the _link_ dies; the response piece survives        |
| engagement (`likes`/`claps`/`bookmarks`) → users, pieces               | CASCADE    | engagement without either side is garbage           |
| `piece_tags.*` → pieces, tags                                          | CASCADE    | pure join                                           |
| `collections.owner_id` → users                                         | CASCADE    | hard erasure only (soft delete first)               |
| `collection_pieces.*`, `reading_list_pieces.*`                         | CASCADE    | membership rows                                     |
| `follows.*` → users                                                    | CASCADE    | edges die with either node                          |
| `reposts.*` → users, pieces                                            | CASCADE    | amplification without source is noise               |
| `notifications.recipient_id` → users                                   | CASCADE    | inbox dies with account                             |
| `notifications.actor_id` → users                                       | SET NULL   | recipient's history outlives the actor              |
| `reports.reporter_id` / `resolved_by` → users                          | SET NULL   | moderation record must survive accounts             |
| `user_roles.role_id` → roles                                           | RESTRICT   | deleting a role must not silently strip privileges  |
| `user_roles.user_id` → users                                           | CASCADE    | grants die with account                             |
| `audit_logs.actor_id` → users                                          | SET NULL   | audit trail is forever                              |
| `daily_prompts` / `featured_writers` `created_by`/`curated_by` → users | SET NULL   | curation outlives curators                          |
| `analytics_*`                                                          | — (no FKs) | ingest hot path + retention pruning (§3.9)          |
