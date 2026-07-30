# Analytics & Insights (E10)

Event-driven analytics. Business modules **emit** domain events; the analytics
listener **aggregates** into counter tables. Business modules never write
analytics. No AI, no background jobs.

## MVP shape (per the epic's improvement)

```
Business event ──▶ DomainEventBus ──▶ AnalyticsListener
                                          ├── update aggregate tables  (APIs read these — fast)
                                          └── record raw view/read events (dedup + trending signal)
```

Aggregates are the source of truth for every API. Raw events (`view_event`,
`read_event`) exist only for unique-view dedup + the recent-view trending signal.
The partitioned `analytics_events` firehose + rollup job (docs 04 §3.9) is the
deferred data-warehouse scale path — public APIs won't change if it lands.

## Events consumed

`PiecePublished` · `PieceArchived` · `PieceViewed` · `ReadCompleted` ·
`CommentCreated` · `ReactionCreated` (clap) · `BookmarkAdded` · `PieceResponseCreated` ·
`UserFollowed`/`FollowAccepted` · `ShareCreated`. New events (`PieceViewed`,
`ReadCompleted`, `BookmarkAdded`, `ShareCreated`, `PieceArchived`) were added to
`common/events`; the last three are emitted additively from `ReactionsService`,
`SharesService`, `PiecesService`. View/read events are emitted by the tracking
endpoints.

## Tables (7, analytics-owned)

`piece_analytics` · `writer_analytics` · `reader_analytics` (satellite aggregates,
PK = subject) · `platform_analytics` (singleton materialized counters) ·
`analytics_snapshot` (growth history) · `view_event` (unique viewers, dedup) ·
`read_event` (read sessions). No engagement data is duplicated — claps/comments/
bookmarks/responses are read from `piece_stats` (piece) or summed over the writer's
pieces (writer).

## View / read tracking

- `POST /analytics/pieces/:id/view` → emits `PieceViewed`. Countable at most once
  per viewer per piece within a Redis cooldown (`VIEW_DEDUP_COOLDOWN_SECONDS`,
  dedup "by viewer/day"); uniqueness via `view_event` unique (piece, viewer).
  Anonymous (session/IP+UA hash) or authenticated (user key).
- `POST /analytics/pieces/:id/read` → emits `ReadCompleted`. A read "completes"
  at ≥30 s dwell AND ≥50 % scroll (docs 04 §3.14). Updates reader streak.

## APIs

| Endpoint                                       | Auth                    |
| ---------------------------------------------- | ----------------------- |
| `POST /analytics/pieces/:id/view` · `/read`    | public (optional-auth)  |
| `GET /analytics/me` · `/me/growth`             | self                    |
| `GET /analytics/readers/me` · `/dashboard`     | self                    |
| `GET /analytics/pieces/:id`                    | owner only              |
| `GET /analytics/trending`                      | public                  |
| `GET /analytics/platform` · `/platform/growth` | `analytics.view` (PBAC) |
| `POST /analytics/snapshots`                    | `analytics.view` (PBAC) |

## Aggregation & performance

Every write is a single-row `INSERT … ON CONFLICT DO UPDATE` (no read-modify-write,
no scans); rows are created lazily so pre-existing data works. Reads hit satellite
PKs, sum a writer's own pieces (indexed by author), or read the windowed
`view_event`. Platform (COUNTs) + trending are Redis-cached (5 min). Indexes:
`idx_piece_analytics_author`, `uq_view_event_piece_viewer` + `idx_view_event_recent`,
`idx_read_event_reader*`, `uq_analytics_snapshot`.

## Snapshots

`generateSnapshots(period)` (admin `POST /analytics/snapshots`, on demand — no cron)
upserts a platform snapshot + one per active writer into `analytics_snapshot`.
Growth APIs read them. Idempotent per (scope, subject, period, period_start).

## Tests

- Unit: listener (aggregation, cooldown/unique, thresholds, share channels, follow),
  service (ingest events, mapping/rates, piece authorization, snapshots).
- E2E (`test/analytics.e2e-spec.ts`): view dedup, read completion + reader streak,
  writer/piece analytics, trending, platform (admin-only), snapshots + growth,
  authorization.
