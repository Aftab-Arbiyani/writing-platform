# Feature Modules (Phase 1)

This directory is intentionally empty in the foundation. The Phase-1 module map
(ADR §3) and each module's single-line responsibility:

| Module          | Responsibility                                                                                                                           |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `auth`          | Registration, login, JWT issue + rotating refresh (reuse-detection denylist in Redis DB 3), Google OAuth (code + PKCE), Argon2id hashing |
| `users`         | Accounts, profiles, follows, permanent username / single pen-name rules, private accounts                                                |
| `pieces`        | Writing lifecycle: drafts → preview → publish (incl. `scheduled-publish` queue), TipTap JSON content, `piece_stats` counters             |
| `taxonomy`      | Languages (hi/ur/en at launch), genres, tags                                                                                             |
| `engagement`    | Likes, claps (≤ 50/user), bookmarks, reposts, quotes, piece→piece responses                                                              |
| `collections`   | Collections and reading lists                                                                                                            |
| `feeds`         | Following / Trending / Latest / Discover timelines — cursor pagination, `trending-score` queue                                           |
| `search`        | Postgres FTS (`simple` + `unaccent` + `pg_trgm`) behind a swappable `SearchService`                                                      |
| `notifications` | In-app notifications + `notifications` / `emails` queues                                                                                 |
| `analytics`     | Append-only event ingestion, `analytics-rollup` queue into daily aggregates                                                              |
| `moderation`    | Reports, moderation actions, audit logging                                                                                               |
| `media`         | Pre-signed S3 uploads, `media-processing` worker (sharp; strips EXIF/GPS)                                                                |
| `prompts`       | Daily writing prompts                                                                                                                    |
| `admin`         | Dashboard, user/piece management, card templates, featured writers, roles, audit-log views                                               |

## Folder convention (every module)

```
modules/<name>/
├── entities/               # TypeORM entities — extend QalamBaseEntity (common/base)
├── dto/                    # Request/response DTOs — class-validator owns validation
├── <name>.controller.ts    # HTTP only: routing, DTOs, Swagger decorators
├── <name>.service.ts       # Business logic; the module's exported surface
├── <name>.repository.ts    # Custom repository via DataSource (optional; isolates TypeORM)
└── <name>.module.ts        # Wires the above; exports services only
```

## Boundary rule (enforced)

**No cross-module repository imports.** Modules communicate exclusively through
each other's exported services or through events/queues. Layering is strict:
controller → service → repository; services never touch query builders outside
their own repositories. Extraction seams to keep clean: workers, search,
analytics.
