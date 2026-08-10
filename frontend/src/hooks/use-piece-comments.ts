import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { conversationApi } from '@/lib/conversation-api';
import { qk } from '@/lib/query-keys';

/**
 * A piece's public comment thread (W7a, docs/45 §4.4).
 *
 * **Two resources, because that is what the contract exposes**: a cursor-paginated list of
 * top-level comments, and a page of replies fetched per parent (`GET /comments/:id/replies`).
 * `CommentResponseDto` carries `replyCount` and no `replies` array.
 *
 * App-level (docs/26 §4): the reader renders the thread and a response leads into the editor, so
 * neither feature may own it.
 */

/** Conversation is social data, not identity — 20 s, matching the collaboration threads. */
const CONVERSATION_STALE = 20 * 1000;

/**
 * Top-level comments on a piece. Enabled only once a piece id is resolved (the reader cold-loads
 * by SLUG, so the id arrives with the piece, not with the URL).
 *
 * Never disabled on the session: this read is `@Public()`, and gating it on auth is what would
 * make a signed-out reader see nothing.
 */
export function usePieceComments(pieceId: string | undefined) {
  return useInfiniteQuery({
    queryKey: qk.conversation.comments(pieceId ?? ''),
    queryFn: ({ pageParam, signal }) => conversationApi.comments(pieceId ?? '', pageParam, signal),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.meta.nextCursor ?? undefined,
    enabled: Boolean(pieceId),
    staleTime: CONVERSATION_STALE,
  });
}

/**
 * One comment's replies. `enabled` is the whole point: a collapsed thread costs nothing, so a page
 * of forty comments issues one request, not forty-one.
 */
export function useCommentReplies(commentId: string | undefined, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: qk.conversation.replies(commentId ?? ''),
    queryFn: ({ pageParam, signal }) => conversationApi.replies(commentId ?? '', pageParam, signal),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.meta.nextCursor ?? undefined,
    enabled: Boolean(commentId) && enabled,
    staleTime: CONVERSATION_STALE,
  });
}

/**
 * The four writes on a comment thread, scoped to one piece.
 *
 * Every one of them can move the list (a new row, a changed body, a tombstone, a `replyCount`), so
 * they invalidate the piece's conversation prefix — plus the affected reply page, whose parent is
 * addressed separately. Deliberately invalidate-and-refetch rather than optimistic splicing: the
 * server owns `depth`, `editedAt`, the tombstone TEXT and the reply counts, and a client that
 * guessed them would show a comment that does not match what the next reader sees.
 *
 * **No offline write queue** — web has none by design, and porting mobile's `SyncEngine` outbox is
 * explicitly out of scope (docs/48 §4, "Partly inherent").
 */
export function useCommentActions(pieceId: string) {
  const client = useQueryClient();

  /** The piece's own conversation — its comment list, and the engagement counts beside it. */
  const invalidatePiece = async (): Promise<void> => {
    await Promise.all([
      client.invalidateQueries({ queryKey: qk.conversation.piece(pieceId) }),
      client.invalidateQueries({ queryKey: qk.pieces.engagement(pieceId) }),
    ]);
  };

  const addComment = useMutation({
    mutationFn: (body: string) => conversationApi.addComment(pieceId, body),
    onSuccess: invalidatePiece,
  });

  /** A reply refreshes the page it landed in AND the list, whose `replyCount` just moved. */
  const reply = useMutation({
    mutationFn: ({ commentId, body }: { commentId: string; body: string }) =>
      conversationApi.reply(commentId, body),
    onSuccess: async (_created, variables) => {
      await Promise.all([
        client.invalidateQueries({ queryKey: qk.conversation.replies(variables.commentId) }),
        invalidatePiece(),
      ]);
    },
  });

  /**
   * Edit. A reply's edit must refresh ITS page, not just the top-level list — which is why the
   * caller passes the `parentId` it already has rather than this hook guessing from `depth`.
   */
  const editComment = useMutation({
    mutationFn: ({
      commentId,
      body,
    }: {
      commentId: string;
      body: string;
      parentId?: string | null;
    }) => conversationApi.editComment(commentId, body),
    onSuccess: async (_updated, variables) => {
      await Promise.all([
        variables.parentId
          ? client.invalidateQueries({ queryKey: qk.conversation.replies(variables.parentId) })
          : Promise.resolve(),
        invalidatePiece(),
      ]);
    },
  });

  /**
   * Soft delete. The row does NOT disappear: the server keeps the node, nulls its author and
   * replaces the body with tombstone text so the replies hanging off it stay reachable. Refetching
   * is therefore mandatory — a client that removed the row locally would take its replies with it.
   */
  const deleteComment = useMutation({
    mutationFn: ({ commentId }: { commentId: string; parentId?: string | null }) =>
      conversationApi.deleteComment(commentId),
    onSuccess: async (_void, variables) => {
      await Promise.all([
        variables.parentId
          ? client.invalidateQueries({ queryKey: qk.conversation.replies(variables.parentId) })
          : Promise.resolve(),
        invalidatePiece(),
      ]);
    },
  });

  return { addComment, reply, editComment, deleteComment };
}
