import type { Visibility } from '@qalam/shared';

import { del, get, getPage, patch, post, type CursorPage } from '@/lib/api-client';
import { buildQueryString } from '@/lib/http';
import type { Collection, CollectionPiece } from '@/types/collection';

/**
 * The collections `api/` boundary (W7b, docs/32 §10) — the only place these eight
 * `modules/engagement` endpoints are named.
 *
 * App level (`lib/`, the `conversation-api.ts` precedent from W7a) because its consumers straddle
 * features: the collections pages list and edit them, while the reader and any piece card SAVE into
 * them. A feature may never import another feature (docs/26 §4).
 *
 * **Every route here is authenticated and owner-scoped** — the controller carries a class-level
 * `@Permissions(collection.manage)`, so unlike W7a's conversation reads there is no public half.
 * Callers must gate on the session before mounting, not after a 401.
 */

const PAGE_LIMIT = 20;

export const collectionsApi = {
  /** GET /collections — the caller's own collections (cursor-paginated). */
  mine: (cursor: string | undefined, signal?: AbortSignal): Promise<CursorPage<Collection>> =>
    getPage<Collection>(`/collections${buildQueryString({ cursor, limit: PAGE_LIMIT })}`, {
      signal,
    }),

  /** GET /collections/:id — one collection's header. */
  detail: (id: string, signal?: AbortSignal): Promise<Collection> =>
    get<Collection>(`/collections/${encodeURIComponent(id)}`, { signal }),

  /** GET /collections/:id/pieces — its pieces (cursor-paginated). */
  pieces: (
    id: string,
    cursor: string | undefined,
    signal?: AbortSignal,
  ): Promise<CursorPage<CollectionPiece>> =>
    getPage<CollectionPiece>(
      `/collections/${encodeURIComponent(id)}/pieces${buildQueryString({ cursor, limit: PAGE_LIMIT })}`,
      { signal },
    ),

  /**
   * POST /collections — `CreateCollectionDto`. Collections default to PRIVATE in Phase 1, and the
   * slug is derived from the title server-side (unique per owner), so it is never sent.
   */
  create: (input: {
    title: string;
    description?: string;
    visibility?: Visibility;
  }): Promise<Collection> => post<Collection>('/collections', input),

  /**
   * PATCH /collections/:id — merge semantics, every field optional.
   *
   * The default "Favorites" collection rejects a title change with
   * `COLLECTION_DEFAULT_IMMUTABLE`; callers hide its edit affordance rather than offering one that
   * gets refused.
   */
  update: (
    id: string,
    input: { title?: string; description?: string; visibility?: Visibility },
  ): Promise<Collection> => patch<Collection>(`/collections/${encodeURIComponent(id)}`, input),

  /** DELETE /collections/:id — removes the collection, never the pieces in it. */
  remove: (id: string): Promise<void> => del(`/collections/${encodeURIComponent(id)}`),

  /** POST /collections/:id/pieces — `AddCollectionPieceDto` (`{ pieceId, note? }`). */
  addPiece: (id: string, pieceId: string, note?: string): Promise<unknown> =>
    post(`/collections/${encodeURIComponent(id)}/pieces`, {
      pieceId,
      ...(note !== undefined && note.trim() !== '' ? { note: note.trim() } : {}),
    }),

  /**
   * DELETE /collections/:id/pieces/:pieceId — un-files the piece.
   *
   * It removes the MEMBERSHIP, not the piece: the piece itself, its author's copy and every other
   * collection containing it are untouched. The UI must say so.
   */
  removePiece: (id: string, pieceId: string): Promise<void> =>
    del(`/collections/${encodeURIComponent(id)}/pieces/${encodeURIComponent(pieceId)}`),
};
