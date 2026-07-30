# Engagement module (E7 — Social & Curation)

Comments · Replies · Likes · Claps · Bookmarks · Collections · Responses · Share tracking.

Built on the writing engine (E3/E4). Every engagement path goes through
`PiecesService.getEngageablePiece(pieceId, viewerId)` — the single reused gate that
enforces read visibility (hidden piece → 404, privacy-preserving) **and** that the piece is
published (→ 409 `PIECE_NOT_PUBLISHED`). No cross-module repository imports; counters live in
`piece_stats` and are bumped in the same transaction as each engagement write (docs 04 §7).

## Endpoints

| Method + path                             | Auth     | Purpose                                     |
| ----------------------------------------- | -------- | ------------------------------------------- |
| `POST /pieces/:id/comments`               | required | Comment on a piece                          |
| `GET /pieces/:id/comments`                | optional | List top-level comments (cursor)            |
| `POST /comments/:id/replies`              | required | Reply (nesting capped at depth 3)           |
| `GET /comments/:id/replies`               | optional | List replies (cursor)                       |
| `PATCH /comments/:id`                     | required | Edit (owner only; stamps `editedAt`)        |
| `DELETE /comments/:id`                    | required | Soft-delete (owner **or** moderator+)       |
| `POST /pieces/:id/likes`                  | required | Like (idempotent)                           |
| `DELETE /pieces/:id/likes`                | required | Unlike (idempotent)                         |
| `POST /pieces/:id/claps`                  | required | Add claps (cap 50/user/piece)               |
| `DELETE /pieces/:id/claps`                | required | Remove all my claps                         |
| `POST /pieces/:id/bookmarks`              | required | Bookmark (private, idempotent)              |
| `DELETE /pieces/:id/bookmarks`            | required | Remove bookmark                             |
| `GET /me/bookmarks`                       | required | My bookmarks (private, cursor)              |
| `GET /pieces/:id/engagement`              | optional | Counts + my like/clap/bookmark state        |
| `POST /collections`                       | required | Create collection (private)                 |
| `GET /collections`                        | required | My collections ("Favorites" always present) |
| `GET /collections/:id`                    | required | Get one (owner only)                        |
| `GET /collections/:id/pieces`             | required | Pieces in a collection (cursor)             |
| `PATCH /collections/:id`                  | required | Rename / re-describe (owner only)           |
| `DELETE /collections/:id`                 | required | Delete (default cannot be deleted)          |
| `POST /collections/:id/pieces`            | required | Add a piece                                 |
| `DELETE /collections/:id/pieces/:pieceId` | required | Remove a piece                              |
| `POST /pieces/:id/responses`              | required | Write a response (creates a linked piece)   |
| `GET /pieces/:id/responses`               | optional | List responses (cursor, visibility-gated)   |
| `POST /pieces/:id/shares`                 | optional | Track a share (internal/external/copy_link) |

All routes are under `/api/v1`. List endpoints use the ADR §5 cursor envelope.

## Manual testing guide

Prereqs — infra + schema:

```bash
docker compose up -d postgres redis minio        # postgres:5434, redis:6380, minio:9000
pnpm --filter backend migration:run              # applies SocialEngagement + all prior
pnpm --filter backend seed                       # languages hi/ur/en + genres (need ur + ghazal)
pnpm --filter backend dev                         # API on :4000, Swagger at /docs
```

Get two access tokens (mobile client → tokens in the body):

```bash
reg() { curl -s -XPOST localhost:4000/api/v1/auth/register -H 'content-type: application/json' \
  -H 'x-client: mobile' -d "{\"email\":\"$1@ex.com\",\"username\":\"$1\",\"password\":\"correct horse battery staple\"}"; }
AUTHOR=$(reg author | jq -r .data.accessToken)
READER=$(reg reader | jq -r .data.accessToken)
A() { curl -s -H "authorization: Bearer $1" "${@:2}"; }
```

Publish a piece to engage with:

```bash
PID=$(A "$AUTHOR" -XPOST localhost:4000/api/v1/pieces -H 'content-type: application/json' \
  -d '{"title":"Nazm","content":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"hi"}]}]},"languageCode":"ur","genreSlug":"ghazal"}' | jq -r .data.id)
A "$AUTHOR" -XPOST localhost:4000/api/v1/pieces/$PID/publish >/dev/null
```

Exercise each feature (expected result in the comment):

```bash
# Comments + replies + depth cap (3)
CID=$(A "$READER" -XPOST localhost:4000/api/v1/pieces/$PID/comments -H 'content-type: application/json' -d '{"body":"lovely"}' | jq -r .data.id)   # 201
A "$AUTHOR" -XPOST localhost:4000/api/v1/comments/$CID/replies -H 'content-type: application/json' -d '{"body":"thanks"}'                          # 201 depth 2
A "$READER" -XPATCH localhost:4000/api/v1/comments/$CID -H 'content-type: application/json' -d '{"body":"edited"}'                                 # 200 editedAt set
A "$AUTHOR" -XPATCH localhost:4000/api/v1/comments/$CID -H 'content-type: application/json' -d '{"body":"hijack"}'                                 # 403 COMMENT_FORBIDDEN
A "$READER" -XDELETE localhost:4000/api/v1/comments/$CID                                                                                            # 204 (tombstone; replies stay)
curl -s localhost:4000/api/v1/pieces/$PID/comments | jq '.data[0].isDeleted'                                                                        # true

# Likes (idempotent) + claps (cap 50) + bookmarks
A "$READER" -XPOST localhost:4000/api/v1/pieces/$PID/likes                                                                                          # {liked:true,totalLikes:1}
A "$READER" -XPOST localhost:4000/api/v1/pieces/$PID/claps -H 'content-type: application/json' -d '{"count":50}'                                    # viewerClaps 50
A "$READER" -XPOST localhost:4000/api/v1/pieces/$PID/claps -H 'content-type: application/json' -d '{"count":1}'                                     # 422 CLAP_LIMIT_REACHED
A "$READER" -XPOST localhost:4000/api/v1/pieces/$PID/bookmarks                                                                                      # {bookmarked:true}
A "$READER" localhost:4000/api/v1/me/bookmarks | jq '.data[0].pieceId'                                                                              # $PID

# Collections (Favorites default + duplicate guard + membership)
COL=$(A "$READER" -XPOST localhost:4000/api/v1/collections -H 'content-type: application/json' -d '{"title":"Monsoon"}' | jq -r .data.id)           # 201
A "$READER" localhost:4000/api/v1/collections | jq '[.data[].title]'                                                                                # ["Favorites","Monsoon"]
A "$READER" -XPOST localhost:4000/api/v1/collections/$COL/pieces -H 'content-type: application/json' -d "{\"pieceId\":\"$PID\"}"                    # piecesCount 1
A "$READER" -XPOST localhost:4000/api/v1/collections/$COL/pieces -H 'content-type: application/json' -d "{\"pieceId\":\"$PID\"}"                    # 409 COLLECTION_PIECE_EXISTS

# Responses (a response IS a new piece)
RID=$(A "$READER" -XPOST localhost:4000/api/v1/pieces/$PID/responses -H 'content-type: application/json' -d '{"title":"re","content":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"x"}]}]},"languageCode":"ur","genreSlug":"ghazal"}' | jq -r .data.id)
A "$READER" -XPOST localhost:4000/api/v1/pieces/$RID/publish >/dev/null
curl -s localhost:4000/api/v1/pieces/$PID/responses | jq '.data | length'                                                                           # >= 1

# Shares (count only; anonymous allowed on public piece)
curl -s -XPOST localhost:4000/api/v1/pieces/$PID/shares -H 'content-type: application/json' -d '{"channel":"copy_link"}' | jq .data                 # {totalShares:n}

# Engagement summary
curl -s localhost:4000/api/v1/pieces/$PID/engagement | jq .data.stats                                                                               # {likes,claps,bookmarks,comments,responses,shares}
```

## Tests

```bash
pnpm --filter backend test        # unit — 38 engagement specs (services)
pnpm --filter backend test:e2e -- engagement    # 21 e2e (needs infra + seed)
```
