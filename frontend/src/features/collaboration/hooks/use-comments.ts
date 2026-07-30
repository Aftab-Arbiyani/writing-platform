import type { CommentKind, CommentStatus } from '@qalam/shared';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { qk } from '@/lib/query-keys';

import { collaborationApi } from '../api/collaboration.api';
import type { CommentAnchor } from '../types/collaboration.types';

/**
 * Story comments (AF6, W3b — docs/49 §5).
 *
 * Two separate resources, because that is what the contract exposes: a cursor-paginated list of
 * **root** comments, and a thread fetched per comment (`GET /comments/:id/thread`). `CommentDto`
 * carries no `replies` array — assuming it did is what left mobile unable to show any reply at all
 * (defect M-3, docs/48 §3.2).
 */
const COMMENTS_STALE = 20 * 1000;

/** Root comments, newest page first, optionally filtered to open or resolved. */
export function useStoryComments(storyId: string | undefined, status?: CommentStatus) {
  return useInfiniteQuery({
    queryKey: qk.stories.comments(storyId ?? '', status),
    queryFn: ({ pageParam, signal }) =>
      collaborationApi.comments(storyId ?? '', { cursor: pageParam, status }, signal),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.meta.nextCursor ?? undefined,
    enabled: Boolean(storyId),
    staleTime: COMMENTS_STALE,
  });
}

/**
 * One thread's replies. Gated on `enabled` so a collapsed thread costs nothing — a story with
 * forty comments should not fire forty thread requests to render a list.
 */
export function useCommentThread(commentId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: qk.comments.thread(commentId ?? ''),
    queryFn: ({ signal }) => collaborationApi.thread(commentId ?? '', signal),
    enabled: Boolean(commentId) && enabled,
    staleTime: COMMENTS_STALE,
  });
}

export function useCommentActions(storyId: string) {
  const client = useQueryClient();

  /** Every comment mutation can change the list, so invalidate the story's comment prefix. */
  const invalidateComments = async (): Promise<void> => {
    await client.invalidateQueries({ queryKey: ['stories', storyId, 'comments'] });
  };

  const addComment = useMutation({
    mutationFn: (input: {
      body: string;
      kind?: CommentKind;
      anchor?: CommentAnchor;
      mentions?: string[];
    }) => collaborationApi.addComment(storyId, input),
    onSuccess: invalidateComments,
  });

  /**
   * A reply goes to its own endpoint with `{body, mentions?}` — never `parentId` on the create
   * route, which the DTO rejects. It refreshes the thread it landed in, plus the list (whose reply
   * counts and ordering can move).
   */
  const reply = useMutation({
    mutationFn: ({
      commentId,
      ...input
    }: {
      commentId: string;
      body: string;
      mentions?: string[];
    }) => collaborationApi.reply(commentId, input),
    onSuccess: async (_created, variables) => {
      await Promise.all([
        client.invalidateQueries({ queryKey: qk.comments.thread(variables.commentId) }),
        invalidateComments(),
      ]);
    },
  });

  const resolveComment = useMutation({
    mutationFn: (commentId: string) => collaborationApi.resolveComment(commentId),
    onSuccess: async (_resolved, commentId) => {
      await Promise.all([
        client.invalidateQueries({ queryKey: qk.comments.thread(commentId) }),
        invalidateComments(),
      ]);
    },
  });

  /** No edit exists — the contract has no `PATCH /comments/:id`, only this soft-delete. */
  const deleteComment = useMutation({
    mutationFn: (commentId: string) => collaborationApi.deleteComment(commentId),
    onSuccess: invalidateComments,
  });

  return { addComment, reply, resolveComment, deleteComment };
}
