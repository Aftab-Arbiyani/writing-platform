/**
 * The public conversation on a piece (W7a, docs/45 §4.4) — the wire shapes of
 * `modules/engagement`'s comments and responses, as the web renders them.
 *
 * App-level rather than inside a feature (docs/26 §4, the `types/profile.ts` precedent): the
 * thread is READ on the reader (`features/reading`) and writing a response ends in the editor
 * (`features/writing`), and a feature may never import another feature.
 *
 * **These are NOT AF6's collaboration comments.** Those are a story's private review
 * (`modules/collaboration`, `CommentDto`) and carry bare author ids, a status and an anchor. These
 * are public conversation on a published piece and carry an embedded author, a tombstone flag and
 * a reply count. Sharing a type between them would couple the two privacy models.
 */

/**
 * `CommentAuthorDto` — the author summary the comment DTO already embeds.
 *
 * This is why W7a needs **no** by-id profile lookup: unlike the collaboration DTOs that forced B3
 * (`GET /users/by-id/:id`), the name is already on the wire. `author` is `null` for a comment whose
 * node survives without a person behind it — a soft-deleted comment, per the DTO's own contract —
 * and the UI says so rather than inventing a name.
 */
export interface CommentAuthor {
  username: string;
  penName: string | null;
  avatarKey: string | null;
}

/**
 * `CommentResponseDto` — one node of a piece's comment thread.
 *
 * `replyCount` is the immediate child count and the ONLY thing the payload says about replies:
 * there is no `replies` array, so children are fetched from `GET /comments/:id/replies`. Assuming
 * an array that the wire does not send is the mistake that left mobile's collaboration threads
 * unable to show a single reply (M-3, docs/48 §3.2).
 *
 * `isDeleted` means `body` IS the server's tombstone text. The node must still render: replies
 * hang off it and disappear with it if a client filters it out.
 */
export interface PieceComment {
  id: string;
  /** Null for a top-level comment. */
  parentId: string | null;
  /** 1 for top-level; parent.depth + 1 for a reply (server caps at `MAX_COMMENT_DEPTH`). */
  depth: number;
  author: CommentAuthor | null;
  body: string;
  isDeleted: boolean;
  replyCount: number;
  /** Last edit time; null if never edited. */
  editedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** `ResponseAuthorDto` — a response row's author. No avatar on this DTO (unlike a comment's). */
export interface ResponseAuthor {
  username: string;
  penName: string | null;
}

/**
 * `ResponseItemDto` — a response to a piece. A response IS a piece, so this is a lightweight piece
 * summary plus the link timestamp; `pieceId` is the CHILD piece and is what the reader link opens.
 */
export interface PieceResponse {
  pieceId: string;
  slug: string | null;
  title: string;
  subtitle: string | null;
  author: ResponseAuthor;
  publishedAt: string | null;
  /** When the response was linked to the parent — the row's own timestamp. */
  respondedAt: string;
}

/**
 * What `POST /pieces/:id/responses` returns: a full `PieceResponseDto` for the newly created,
 * linked DRAFT. Only the identity fields are modelled — the write flow ends by navigating to this
 * draft in the editor, which loads the piece itself.
 */
export interface CreatedResponseDraft {
  id: string;
  title: string;
  slug: string | null;
}
