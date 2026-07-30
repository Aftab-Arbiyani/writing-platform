# Feed & Discovery module (E6 — Feeds)

Following · Latest · Trending · Discover feeds + discovery surfaces (writers, pieces,
trending tags/genres/languages). Read-only over existing entities — **no new tables**
(the optional `FeedScore`/`TrendingCache` were judged unnecessary; trending is computed
live and cached in Redis). Search is a separate epic (E8) and is not implemented here.

## Endpoints (all under `/api/v1`)

| Method + path             | Auth     | Purpose                                                      |
| ------------------------- | -------- | ------------------------------------------------------------ |
| `GET /feed/following`     | required | Pieces from accepted-followed authors, newest first          |
| `GET /feed/latest`        | public   | Newest public pieces; filterable + sortable                  |
| `GET /feed/trending`      | public   | Trending ranking (configurable score; Redis-cached snapshot) |
| `GET /feed/discover`      | public   | Author-diverse public feed (one recent piece per author)     |
| `GET /discover/writers`   | public   | `?kind=featured\|popular\|new`                               |
| `GET /discover/pieces`    | public   | `?kind=featured\|recent\|most_clapped\|most_discussed`       |
| `GET /discover/tags`      | public   | Trending tags (cached)                                       |
| `GET /discover/genres`    | public   | Trending genres (cached)                                     |
| `GET /discover/languages` | public   | Trending languages (cached)                                  |

**Filters** (`/feed/latest`, `/feed/following`): `language` (csv codes), `genre` (csv slugs),
`tag`, `visibility`, `dateFrom`, `dateTo`, `minReadingTime`, `maxReadingTime`, `sort`
(`latest | trending | most_clapped | most_discussed`). **Pagination:** cursor everywhere
(`limit`, `cursor` → `meta.pagination.{hasMore,nextCursor}`).

## Trending algorithm (configurable)

`score = (wClaps·claps + wComments·comments + wResponses·responses + wCompletion·completion)
/ (ageHours + 2)^gravity` — weights + window are env-overridable (`TRENDING_W_CLAPS`,
`TRENDING_W_COMMENTS`, `TRENDING_W_RESPONSES`, `TRENDING_W_COMPLETION`, `TRENDING_GRAVITY`,
`TRENDING_LOOKBACK_DAYS`, `TRENDING_SNAPSHOT_SIZE`, `TRENDING_CACHE_TTL`); see
`scoring/trending-scoring.ts` + `config/trending.config.ts`. The top-N ranking is cached in
Redis DB 0 for `TRENDING_CACHE_TTL`s (default 300) and keyset-paginated in memory.

## Cache strategy (Redis DB 0)

| Cache key                             | Contents                            | TTL  | Invalidation                  |
| ------------------------------------- | ----------------------------------- | ---- | ----------------------------- |
| `feed:trending:v1`                    | ranked `[{pieceId,score}]` snapshot | 300s | TTL · `invalidateTrending()`  |
| `discover:writers:featured:v1`        | top-N featured writer pool          | 600s | TTL · `invalidateDiscovery()` |
| `discover:writers:popular:v1:{n}`     | popular writers first page          | 600s | TTL · `invalidateDiscovery()` |
| `discover:tags\|genres\|languages:v1` | trending taxonomy top-N             | 600s | TTL · `invalidateDiscovery()` |

Reads degrade gracefully: a Redis outage logs and falls back to a live query. Explicit
`invalidate*()` methods are exposed for a future publish/engagement event wiring.

## Query optimization

- One joined query per card (pieces + piece_stats + users + profiles + languages + genres) —
  no N+1; only card fields selected.
- Keyset (cursor) pagination on every DB feed — O(index seek), never `OFFSET`.
- Indexes: `idx_pieces_latest` (latest/discover/trending base), `idx_pieces_author_published`
  (following), `idx_pieces_language`/`idx_pieces_genre` (filters), `idx_piece_stats_claps`/
  `idx_piece_stats_comments` (most-clapped/discussed), `idx_piece_stats_trending`.
- Discover uses `DISTINCT ON (author_id)` for one-piece-per-author, keyset over publish time.
- Trending/featured/trending-taxonomy computed once per TTL and paginated in memory.

## Manual testing guide

Prereqs (same infra as prior epics):

```bash
docker compose up -d postgres redis minio
pnpm --filter backend migration:run    # applies FeedIndexes + all prior
pnpm --filter backend seed             # languages hi/ur/en + genres
pnpm --filter backend dev              # API on :4000, Swagger at /docs
```

```bash
reg() { curl -s -XPOST localhost:4000/api/v1/auth/register -H 'content-type: application/json' \
  -H 'x-client: mobile' -d "{\"email\":\"$1@ex.com\",\"username\":\"$1\",\"password\":\"correct horse battery staple\"}"; }
A() { curl -s -H "authorization: Bearer $1" "${@:2}"; }
AL=$(reg al | jq -r .data.accessToken); ALID=$(reg al2 | jq -r .data.user.id)   # (register a few authors)
RE=$(reg re | jq -r .data.accessToken)

# Publish some public pieces, then browse:
curl -s 'localhost:4000/api/v1/feed/latest?limit=10' | jq '.data[].title'
curl -s 'localhost:4000/api/v1/feed/latest?language=ur&genre=ghazal&sort=most_clapped' | jq '.meta.pagination'
curl -s 'localhost:4000/api/v1/feed/trending?limit=10' | jq '.data | length'
curl -s 'localhost:4000/api/v1/feed/discover?limit=10' | jq '[.data[].author.username] | unique | length'  # == data length (no dup authors)
A "$RE" 'localhost:4000/api/v1/feed/following?limit=10' | jq '.data[].title'                                 # only followed authors
curl -s 'localhost:4000/api/v1/discover/writers?kind=popular&limit=10' | jq '.data[].username'
curl -s 'localhost:4000/api/v1/discover/writers?kind=new' | jq '.data | length'
curl -s 'localhost:4000/api/v1/discover/pieces?kind=most_discussed' | jq '.data | length'
curl -s 'localhost:4000/api/v1/discover/tags'   | jq '.data'
curl -s 'localhost:4000/api/v1/discover/genres' | jq '.data'
curl -s 'localhost:4000/api/v1/feed/latest?cursor=garbage'  # 400 FEED_INVALID_CURSOR

# Cursor pagination:
N=$(curl -s 'localhost:4000/api/v1/feed/latest?limit=1' | jq -r '.meta.pagination.nextCursor')
curl -s "localhost:4000/api/v1/feed/latest?limit=1&cursor=$N" | jq '.data[0].id'
```

## Tests

```bash
pnpm --filter backend test -- feed          # 39 unit specs
pnpm --filter backend test:e2e -- feed      # 16 e2e (needs infra + seed)
```
