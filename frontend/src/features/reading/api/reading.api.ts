import type { RecommendationResponse } from '@qalam/api-types';

import { del, get, getPage, post, type CursorPage } from '@/lib/api-client';
import { buildQueryString } from '@/lib/http';

import type {
  ClapResult,
  LikeResult,
  PieceDetail,
  PieceEngagement,
  RelatedPiece,
  ShareChannel,
} from '../types/reading.types';

/**
 * The reading view's `api/` layer — the only place these endpoints are named (docs/32 §10).
 *
 * `bySlug` is the cold-load entry point: a reader arriving from a link, a search result, or a
 * notification has a slug and no id, and `GET /pieces/:id` is UUID-only. The by-slug route is
 * the additive B1 endpoint (docs 25 amendment, docs/45 §3) and enforces exactly the same
 * visibility rules — an unpublished or private piece 404s for anyone but its author.
 */
export const readingApi = {
  /** GET /pieces/by-slug/:slug — the full piece for the reading surface. */
  bySlug: (slug: string, signal?: AbortSignal): Promise<PieceDetail> =>
    get<PieceDetail>(`/pieces/by-slug/${encodeURIComponent(slug)}`, { signal }),

  /** GET /pieces/:id — same payload, when the id is already known (in-app navigation). */
  byId: (id: string, signal?: AbortSignal): Promise<PieceDetail> =>
    get<PieceDetail>(`/pieces/${encodeURIComponent(id)}`, { signal }),

  /**
   * GET /pieces/:id/engagement — counts + this viewer's own state, one O(1) read. Public:
   * anonymous readers get real counts and an all-false viewer block, so the action bar can
   * render before (and without) sign-in.
   */
  engagement: (pieceId: string, signal?: AbortSignal): Promise<PieceEngagement> =>
    get<PieceEngagement>(`/pieces/${encodeURIComponent(pieceId)}/engagement`, { signal }),

  // ── Reader actions (all authenticated; the bar routes anonymous readers to sign-in) ────────

  /** POST /pieces/:id/likes — returns the authoritative total, which corrects the optimism. */
  like: (pieceId: string): Promise<LikeResult> =>
    post<LikeResult>(`/pieces/${encodeURIComponent(pieceId)}/likes`),

  /** DELETE /pieces/:id/likes — idempotent. */
  unlike: (pieceId: string): Promise<void> => del(`/pieces/${encodeURIComponent(pieceId)}/likes`),

  /**
   * POST /pieces/:id/claps — adds `count` claps and returns the authoritative
   * `{ viewerClaps, totalClaps }` (W7b).
   *
   * **`count` is why a burst is one request.** The endpoint accumulates rather than toggling, so the
   * client batches a burst of clicks and flushes once (see `use-claps`). The server applies
   * `min(count, MAX - current)`, so it also clamps — but the client caps first, because a request
   * sent when already at the cap answers `CLAP_LIMIT_REACHED` and a reader tapping a maxed-out
   * button should meet nothing at all, not an error.
   *
   * 200, not 201: this is an accumulation on an existing relationship, not a creation.
   */
  clap: (pieceId: string, count: number): Promise<ClapResult> =>
    post<ClapResult>(`/pieces/${encodeURIComponent(pieceId)}/claps`, { count }),

  /**
   * DELETE /pieces/:id/claps — removes ALL of this viewer's claps on the piece (204).
   *
   * There is no decrement endpoint and this is not one. Any affordance built on it has to say
   * "remove my claps", never "-1".
   */
  unclap: (pieceId: string): Promise<void> => del(`/pieces/${encodeURIComponent(pieceId)}/claps`),

  bookmark: (pieceId: string): Promise<unknown> =>
    post(`/pieces/${encodeURIComponent(pieceId)}/bookmarks`),

  unbookmark: (pieceId: string): Promise<void> =>
    del(`/pieces/${encodeURIComponent(pieceId)}/bookmarks`),

  /** POST /pieces/:id/shares — records that a share happened, per channel. */
  share: (pieceId: string, channel: ShareChannel): Promise<unknown> =>
    post(`/pieces/${encodeURIComponent(pieceId)}/shares`, { channel }),

  /**
   * "More like this" — a tag-filtered piece search (`GET /search/pieces`), NOT a dedicated
   * related-pieces endpoint, because none exists and W1 adds no backend (docs/45 §7). The
   * frozen contract requires a non-empty `q`, so the tag's own NAME is the query and its SLUG is
   * the filter: FTS matches tags, so the two agree rather than fight.
   *
   * **Still here after W5, and not as a leftover.** The AF4 recommender below is the better answer
   * where it can be reached, but it needs auth plus `ai.use` plus a live feature flag — none of which
   * a signed-out reader has, and they are most of a public reading page's traffic. This is the
   * fallback that keeps the section working for them.
   */
  related: (tag: { slug: string; name: string }, signal?: AbortSignal): Promise<RelatedPiece[]> =>
    getPage<RelatedPiece>(
      `/search/pieces${buildQueryString({ q: tag.name, tag: tag.slug, sort: 'trending', limit: 5 })}`,
      { signal },
    ).then((page: CursorPage<RelatedPiece>) => page.items),

  /**
   * GET /ai/recommendations?kind=related_stories&pieceId=… — the AF4 recommender's answer to "more
   * like this" (W5).
   *
   * **This is the upgrade W1 deferred to this row**, and it is strictly better than the tag search
   * above where it is available: the server seeds from ALL of the piece's tags plus its title rather
   * than the first tag alone, excludes the piece from its own results, and returns a `reason` for
   * each item — which is what makes it a recommendation instead of a list.
   *
   * It cannot replace the tag search, only precede it: every AF4 route needs auth + `ai.use` +
   * `feature.ai.recommendations`, so a signed-out reader — the majority of a public reading page's
   * traffic — can never reach it. The fallback is the point, not a leftover.
   *
   * Named here as well as in `features/search` because a feature may not import another feature
   * (docs/26 §4) — the same reason `related` above names `/search/pieces`.
   */
  recommendedFor: (pieceId: string, signal?: AbortSignal): Promise<RecommendationResponse> =>
    get<RecommendationResponse>(
      `/ai/recommendations${buildQueryString({
        kind: 'related_stories',
        pieceId,
        limit: 5,
      })}`,
      { signal },
    ),
};
