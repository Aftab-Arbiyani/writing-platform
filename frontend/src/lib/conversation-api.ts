import { del, getPage, patch, post, type CursorPage } from '@/lib/api-client';
import { buildQueryString } from '@/lib/http';
import type { CreatedResponseDraft, PieceComment, PieceResponse } from '@/types/conversation';

/**
 * The conversation layer's `api/` boundary (W7a, docs/32 §10) — the ONLY place these eight
 * `modules/engagement` endpoints are named.
 *
 * App-level (`lib/`, the `upload.ts` precedent) rather than inside a feature, because its two
 * consumers straddle the feature boundary: the thread is read on the reader and writing a response
 * ends in the editor. A feature may never import another feature (docs/26 §4).
 *
 * **Read is public, write is not.** `GET /pieces/:id/comments`, `GET /comments/:id/replies` and
 * `GET /pieces/:id/responses` are all `@Public()` + `OptionalAuthGuard`: a signed-out reader must
 * see the conversation. Only the four writes need a session. Nothing here fires a read that
 * requires auth on a public page — W5-6 shipped one, and the resulting 401 cleared the query cache
 * and broke the page for every signed-out visitor (docs/48 §3.9).
 */

/** How many rows a page of the conversation asks for. Cursor pagination on every list. */
const PAGE_LIMIT = 20;

export const conversationApi = {
  // ── Comments ──────────────────────────────────────────────────────────────────

  /** GET /pieces/:id/comments — top-level comments only (cursor-paginated, public). */
  comments: (
    pieceId: string,
    cursor: string | undefined,
    signal?: AbortSignal,
  ): Promise<CursorPage<PieceComment>> =>
    getPage<PieceComment>(
      `/pieces/${encodeURIComponent(pieceId)}/comments${buildQueryString({ cursor, limit: PAGE_LIMIT })}`,
      { signal },
    ),

  /**
   * GET /comments/:id/replies — one comment's children (cursor-paginated, public).
   *
   * A separate resource by contract: `CommentResponseDto` carries `replyCount` and no `replies`
   * array, so this is the only way to see a reply at all.
   */
  replies: (
    commentId: string,
    cursor: string | undefined,
    signal?: AbortSignal,
  ): Promise<CursorPage<PieceComment>> =>
    getPage<PieceComment>(
      `/comments/${encodeURIComponent(commentId)}/replies${buildQueryString({ cursor, limit: PAGE_LIMIT })}`,
      { signal },
    ),

  /** POST /pieces/:id/comments — `{ body }` and nothing else. Requires `comment.create`. */
  addComment: (pieceId: string, body: string): Promise<PieceComment> =>
    post<PieceComment>(`/pieces/${encodeURIComponent(pieceId)}/comments`, { body }),

  /**
   * POST /comments/:id/replies — the SAME `CreateCommentDto` as a top-level comment.
   *
   * The parent comes from the URL, never from the body: `CreateCommentDto` is `{ body }` under
   * `forbidNonWhitelisted`, so sending a `parentId` is a 400.
   */
  reply: (commentId: string, body: string): Promise<PieceComment> =>
    post<PieceComment>(`/comments/${encodeURIComponent(commentId)}/replies`, { body }),

  /** PATCH /comments/:id — owner only; the server records `editedAt`. */
  editComment: (commentId: string, body: string): Promise<PieceComment> =>
    patch<PieceComment>(`/comments/${encodeURIComponent(commentId)}`, { body }),

  /**
   * DELETE /comments/:id — a SOFT delete (204). The node survives as a tombstone and its replies
   * stay visible, so the caller refetches rather than splicing the row out of the cache.
   */
  deleteComment: (commentId: string): Promise<void> =>
    del(`/comments/${encodeURIComponent(commentId)}`),

  // ── Responses ─────────────────────────────────────────────────────────────────

  /** GET /pieces/:id/responses — cursor-paginated, PUBLIC (visibility-gated server-side). */
  responses: (
    pieceId: string,
    cursor: string | undefined,
    signal?: AbortSignal,
  ): Promise<CursorPage<PieceResponse>> =>
    getPage<PieceResponse>(
      `/pieces/${encodeURIComponent(pieceId)}/responses${buildQueryString({ cursor, limit: PAGE_LIMIT })}`,
      { signal },
    ),

  /**
   * POST /pieces/:id/responses — creates a linked DRAFT piece and returns it. Requires
   * `piece.create`.
   *
   * It is deliberately NOT subject to B4's plan piece cap: that gate lives in `POST /pieces` alone,
   * and this route reaches `PiecesService.createDraft` beneath it, because capping responses would
   * block a reader from replying — which B4 does not ask for (`pieces.service.ts`). So no allowance
   * needs checking before offering the affordance; a 403 can still come back, and is surfaced.
   *
   * The body is `CreatePieceDto`, so `languageCode` is required; the parent's language is the
   * sensible default (a response to an Urdu piece is written in Urdu). Nothing else is sent — the
   * writer titles and fills the draft in the editor, which is where this flow ends.
   */
  createResponse: (
    pieceId: string,
    input: { languageCode: string; title?: string },
  ): Promise<CreatedResponseDraft> =>
    post<CreatedResponseDraft>(`/pieces/${encodeURIComponent(pieceId)}/responses`, {
      languageCode: input.languageCode,
      ...(input.title !== undefined && input.title.trim() !== ''
        ? { title: input.title.trim() }
        : {}),
    }),
};

/** Re-exported so callers can type a page without reaching into `api-client`. */
export type { CursorPage };
