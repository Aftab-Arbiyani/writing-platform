import { CommentStatus, POLICY_ACTIONS } from '@qalam/shared';
import { QButton, QEmptyState, QErrorState, QSectionHeader, QSkeleton } from '@qalam/ui';
import { MessagesSquare } from 'lucide-react';
import { type ReactElement, useState } from 'react';
import { useParams } from 'react-router';

import { usePageTitle } from '@/hooks/use-page-title';
import { getErrorMessage, getRequestId } from '@/lib/errors';

import { CapabilityGate } from '../components/capability-gate';
import { CommentComposer } from '../components/comment-composer';
import { CommentThread } from '../components/comment-thread';
import { useCommentActions, useStoryComments } from '../hooks/use-comments';
import { isCollaborationEnabled } from '../lib/collaboration-enabled';

/**
 * A story's comments (`/write/:storyId/comments`, AF6 W3b) — mobile's `comments_screen`, rebuilt
 * against the DTOs rather than ported (docs/48 §3.2).
 *
 * Root comments only, cursor-paginated with an open/resolved filter; each thread loads its own
 * replies on demand. Composing is gated on `story.comment`.
 */
const FILTERS: { label: string; value: CommentStatus | undefined }[] = [
  { label: 'All', value: undefined },
  { label: 'Open', value: CommentStatus.Open },
  { label: 'Resolved', value: CommentStatus.Resolved },
];

export function CommentsPage(): ReactElement {
  usePageTitle('Comments');
  const { storyId = '' } = useParams<{ storyId: string }>();
  const [status, setStatus] = useState<CommentStatus | undefined>(undefined);

  const enabled = isCollaborationEnabled();
  const query = useStoryComments(enabled ? storyId : undefined, status);
  const { addComment } = useCommentActions(storyId);

  if (!enabled) {
    return (
      <div className="mx-auto flex w-full max-w-[760px] flex-col gap-4 px-4 py-6 sm:px-6">
        <QEmptyState
          icon={MessagesSquare}
          title="Collaboration is off"
          description="Enable collaboration to co-write and review with others."
        />
      </div>
    );
  }

  const comments = query.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-col gap-6 px-4 py-6 sm:px-6">
      <QSectionHeader
        title={<h1 className="text-ink font-serif text-2xl font-semibold">Comments</h1>}
        description="Discussion on this story, from the people working on it."
        actions={
          <div className="flex gap-1" role="group" aria-label="Filter comments">
            {FILTERS.map((filter) => (
              <QButton
                key={filter.label}
                size="sm"
                variant={status === filter.value ? 'secondary' : 'ghost'}
                aria-pressed={status === filter.value}
                onClick={() => setStatus(filter.value)}
              >
                {filter.label}
              </QButton>
            ))}
          </div>
        }
      />

      <CapabilityGate storyId={storyId} action={POLICY_ACTIONS.StoryComment}>
        <CommentComposer
          isPending={addComment.isPending}
          onSubmit={(body) => addComment.mutateAsync({ body })}
        />
      </CapabilityGate>

      {query.isLoading ? (
        <div
          role="status"
          aria-busy="true"
          aria-label="Loading comments"
          className="flex flex-col gap-3"
        >
          {Array.from({ length: 3 }).map((_, index) => (
            <QSkeleton key={index} variant="text" lines={3} />
          ))}
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
        <QEmptyState
          icon={MessagesSquare}
          title="No comments yet"
          description="Leave the first note for your collaborators."
        />
      ) : (
        <>
          <ul className="flex flex-col gap-3">
            {comments.map((comment) => (
              <li key={comment.id}>
                <CommentThread storyId={storyId} comment={comment} />
              </li>
            ))}
          </ul>

          {query.hasNextPage ? (
            <QButton
              variant="secondary"
              loading={query.isFetchingNextPage}
              onClick={() => {
                void query.fetchNextPage();
              }}
            >
              Load more
            </QButton>
          ) : null}
        </>
      )}
    </div>
  );
}
