import { QButton, QErrorState, QSkeleton, useToast } from '@qalam/ui';
import type { ReactElement } from 'react';
import { Link } from 'react-router';

import { useInfiniteScroll } from '@/hooks/use-infinite-scroll';
import { useCommentActions, usePieceComments } from '@/hooks/use-piece-comments';
import { getErrorMessage, getRequestId } from '@/lib/errors';
import { ROUTES } from '@/lib/routes';
import { useAuthStore } from '@/stores/auth.store';

import { CommentComposer } from './comment-composer';
import { CommentItem } from './comment-item';

/**
 * A piece's comments (W7a, docs/45 §4.4) — the composer, the paginated list of top-level comments,
 * and each one's expandable replies.
 *
 * **The list is public and the composer is not**, and that split is the whole gating story:
 * `GET /pieces/:id/comments` is `@Public()` + `OptionalAuthGuard`, so a signed-out reader reads the
 * conversation and is shown a sign-in link instead of a composer. Gating the READ is the defect W5-6
 * shipped (docs/48 §3.9) — the 401 cleared the cache and broke the page for every visitor.
 *
 * Pagination is cursor-based and infinite, with the same sentinel every other timeline uses plus an
 * explicit "More comments" button — the sentinel is a no-op without `IntersectionObserver`, and a
 * conversation at the end of a long article should not depend on one.
 */
export interface CommentListProps {
  pieceId: string;
  /** Where sign-in returns to — the piece's own canonical path. */
  returnTo: string;
}

export function CommentList({ pieceId, returnTo }: CommentListProps): ReactElement {
  const authed = useAuthStore((s) => s.status) === 'authenticated';
  const toast = useToast();
  const query = usePieceComments(pieceId);
  const { addComment } = useCommentActions(pieceId);

  const comments = query.data?.pages.flatMap((page) => page.items) ?? [];
  const sentinelRef = useInfiniteScroll<HTMLDivElement>({
    hasMore: Boolean(query.hasNextPage),
    isLoading: query.isFetchingNextPage,
    onLoadMore: () => {
      void query.fetchNextPage();
    },
  });

  return (
    <section aria-labelledby="piece-comments-heading" className="flex flex-col gap-6">
      <h2 id="piece-comments-heading" className="text-ink font-serif text-2xl font-semibold">
        Comments
      </h2>

      {authed ? (
        <CommentComposer
          label="Add a comment"
          placeholder="Share what you thought…"
          submitLabel="Comment"
          isPending={addComment.isPending}
          onSubmit={async (body) => {
            try {
              await addComment.mutateAsync(body);
            } catch (err) {
              toast.error('Couldn’t post your comment', { description: getErrorMessage(err) });
              throw err; // keeps the typed text in the composer
            }
          }}
        />
      ) : (
        <p className="text-ink-secondary text-sm">
          <Link
            to={`${ROUTES.login}?returnTo=${encodeURIComponent(returnTo)}`}
            className="text-accent hover:underline"
          >
            Sign in
          </Link>{' '}
          to join the conversation.
        </p>
      )}

      {query.isLoading ? (
        <div role="status" aria-busy="true" aria-label="Loading comments">
          <QSkeleton variant="text" lines={4} />
        </div>
      ) : query.isError ? (
        <QErrorState
          title="Couldn’t load the comments."
          description={getErrorMessage(query.error)}
          requestId={getRequestId(query.error)}
          onRetry={() => {
            void query.refetch();
          }}
        />
      ) : comments.length === 0 ? (
        <p className="text-ink-secondary text-sm">
          No comments yet. Be the first to say something.
        </p>
      ) : (
        <ul className="flex list-none flex-col gap-6 p-0">
          {comments.map((comment) => (
            <li key={comment.id}>
              <CommentItem pieceId={pieceId} comment={comment} />
            </li>
          ))}
        </ul>
      )}

      <div ref={sentinelRef} aria-hidden />
      {query.hasNextPage ? (
        <div>
          <QButton
            variant="secondary"
            size="sm"
            loading={query.isFetchingNextPage}
            onClick={() => {
              void query.fetchNextPage();
            }}
          >
            More comments
          </QButton>
        </div>
      ) : null}
    </section>
  );
}
