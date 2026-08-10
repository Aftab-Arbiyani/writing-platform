import type { Visibility } from '@qalam/shared';

/**
 * Reading lists / collections (W7b, docs/45 §4.4) — the wire shapes of
 * `modules/engagement`'s collections, as the web renders them.
 *
 * App level rather than inside a feature (docs/26 §4): a collection is LISTED and edited on its own
 * pages, but a piece is SAVED into one from the reader and from a feed card. Three features would
 * otherwise have to import each other.
 *
 * **Owner-only in Phase 1.** Every collections route carries `@Permissions(collection.manage)` and
 * every read is scoped to the caller, so `visibility` is accepted for forward-compatibility and
 * nothing here is a public surface yet.
 */

/** `CollectionResponseDto` — a collection's metadata. */
export interface Collection {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  coverImageKey: string | null;
  visibility: Visibility;
  /**
   * True for the auto-created "Favorites" collection. It cannot be renamed
   * (`COLLECTION_DEFAULT_IMMUTABLE`) or deleted, so its edit affordances are hidden rather than
   * offered-and-refused — the C-1 / W3c-1 lesson.
   */
  isDefault: boolean;
  piecesCount: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * `CollectionPieceItemDto` — a piece inside a collection.
 *
 * Deliberately NOT a `PieceSummary`: the join returns only what a row renders. `pieceId` is what
 * the reader link opens, falling back from `slug` when the piece has none.
 */
export interface CollectionPiece {
  pieceId: string;
  slug: string | null;
  title: string;
  position: number;
  /** The curator's note on this entry (max 300 chars server-side). */
  note: string | null;
  addedAt: string;
}
