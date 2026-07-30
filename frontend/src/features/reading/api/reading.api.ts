import { del, get, getPage, post, type CursorPage } from '@/lib/api-client';
import { buildQueryString } from '@/lib/http';

import type {
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
   * the filter: FTS matches tags, so the two agree rather than fight. The AF4 recommender
   * (`GET /ai/recommendations`) is the eventual home for this — it needs auth plus the `ai.use`
   * permission, which a signed-out reader does not have, so it belongs to W5, not here.
   */
  related: (tag: { slug: string; name: string }, signal?: AbortSignal): Promise<RelatedPiece[]> =>
    getPage<RelatedPiece>(
      `/search/pieces${buildQueryString({ q: tag.name, tag: tag.slug, sort: 'trending', limit: 5 })}`,
      { signal },
    ).then((page: CursorPage<RelatedPiece>) => page.items),
};
