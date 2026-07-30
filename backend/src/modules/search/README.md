# Search & Discovery (E8)

PostgreSQL full-text search behind the `SearchService` seam (the ADR-designated
Meilisearch extraction point, docs 02 §6.4). No Elasticsearch, no AI/semantic
search — `simple` config + `immutable_unaccent` + `pg_trgm`, exactly as docs 04 §6
prescribes.

## Endpoints

| Method + path               | Auth     | Rate tier | Returns                                       |
| --------------------------- | -------- | --------- | --------------------------------------------- |
| `GET /search`               | optional | `search`  | grouped preview (writers/pieces/tags/…)       |
| `GET /search/pieces`        | optional | `search`  | cursor page of pieces (ranked)                |
| `GET /search/writers`       | optional | `search`  | cursor page of writers (ranked)               |
| `GET /search/tags`          | public   | `search`  | cursor page of tags + piece counts            |
| `GET /search/genres`        | public   | `search`  | cursor page of genres + piece counts          |
| `GET /search/languages`     | public   | `search`  | cursor page of languages + piece counts       |
| `GET /search/autocomplete`  | public   | `search`  | ≤10 suggestions per group (cached)            |
| `GET /search/trending`      | public   | `read`    | popular keywords/tags/genres/writers (cached) |
| `GET /search/recent`        | required | `read`    | the user's recent searches (≤20)              |
| `DELETE /search/recent/:id` | required | `read`    | 204                                           |
| `DELETE /search/recent`     | required | `read`    | 204                                           |

Optional-auth endpoints attach the viewer (`OptionalAuthGuard`) so a signed-in
user's searches land in their recent history; keyword popularity is recorded for
everyone.

## Ranking

- **Pieces** — `ts_rank(search_vector, websearch_to_tsquery('simple', immutable_unaccent(q)))`
  plus a trigram boost on the title; typo-tolerant via `title % q`; featured quote
  matched with an index-backed `ILIKE`, tags/slug matched directly. Sort:
  `relevance` (default) · `latest` · `trending` · `most_clapped` · `most_commented`.
- **Writers** — FTS over pen name (A) + bio (B) for public accounts, trigram over
  username/pen name for all; private accounts are findable by name only and
  returned as a teaser (no bio).
- **Tags/genres/languages** — ranked by live public-piece count.

## Visibility

Every read enforces `published + public + non-private author` in the repository
(docs 13 §4.2). Unlisted pieces and private-account pieces never appear. Private
writers appear as name-only teasers. Blocked-user filtering is a documented
future seam (Phase 2).

## Caching

Autocomplete (60 s) and trending (300 s) read through `SearchCacheService`
(Redis DB 0); a Redis outage degrades to a live query, never an error.

## Data

Owns two tables (`recent_searches`, `search_keywords`); everything else is read
by table name via the DataSource (no cross-module entity imports, docs 16 §3.1).
FTS assets (`search_vector` columns, GIN + trigram indexes) come from E1/E3/E4.

## Tests

- Unit: `search.util.spec.ts` (normalization, cursor, patterns), `search.service.spec.ts`
  (ranking wiring, validation, recording, teaser, cache, error mapping).
- E2E: `test/search.e2e-spec.ts` — every endpoint, ranking, cursor pagination,
  filtering, autocomplete, trending, recent searches, and the authorization rules.
