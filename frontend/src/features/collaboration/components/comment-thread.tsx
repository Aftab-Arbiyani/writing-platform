import { CommentKind, CommentStatus, POLICY_ACTIONS } from '@qalam/shared';
import { QButton, QCard, QTag } from '@qalam/ui';
import { type ReactElement, useState } from 'react';

import { formatRelativeTime } from '@/lib/format';

import { useCommentActions, useCommentThread } from '../hooks/use-comments';
import type { CollaborationComment } from '../types/collaboration.types';
import { CapabilityGate } from './capability-gate';
import { CollaboratorIdentity } from './collaborator-identity';
import { CommentComposer } from './comment-composer';

/**
 * One comment thread (AF6, W3b) — a root comment, its replies, and the actions on it.
 *
 * Replies are fetched **only when the thread is expanded** (`GET /comments/:id/thread`), because
 * `CommentDto` carries no `replies` array. A list of forty comments must not fire forty thread
 * requests to render.
 *
 * Resolve and delete are capability-gated on `comment.resolve` / `comment.delete`; the server
 * re-checks both. There is no edit — the contract exposes no `PATCH /comments/:id`.
 */
export interface CommentThreadProps {
  storyId: string;
  comment: CollaborationComment;
}

export function CommentThread({ storyId, comment }: CommentThreadProps): ReactElement {
  const [expanded, setExpanded] = useState(false);
  const [replying, setReplying] = useState(false);
  const thread = useCommentThread(comment.id, expanded);
  const { reply, resolveComment, deleteComment } = useCommentActions(storyId);

  const resolved = comment.status === CommentStatus.Resolved;
  const replies = thread.data?.replies ?? [];

  return (
    <QCard>
      <article className="flex flex-col gap-3">
        <header className="flex flex-wrap items-center justify-between gap-2">
          <CollaboratorIdentity userId={comment.authorId} />
          <div className="flex items-center gap-2">
            {comment.kind === CommentKind.Inline ? <QTag size="sm">Inline</QTag> : null}
            {resolved ? (
              <QTag size="sm" color="success">
                Resolved
              </QTag>
            ) : null}
            <span className="text-ink-muted text-xs">{formatRelativeTime(comment.createdAt)}</span>
          </div>
        </header>

        {/* An inline comment's anchor quote is the only clue to WHERE it applies — the reader has
            no editor open here, so without it the comment floats free of the prose. */}
        {comment.anchor?.quote ? (
          <blockquote className="border-line text-ink-secondary border-s-2 ps-3 text-sm italic">
            <bdi>{comment.anchor.quote}</bdi>
          </blockquote>
        ) : null}

        <p className="text-ink text-sm whitespace-pre-wrap">
          <bdi>{comment.body}</bdi>
        </p>

        <footer className="flex flex-wrap items-center gap-2">
          <QButton
            variant="ghost"
            size="sm"
            onClick={() => setExpanded((open) => !open)}
            aria-expanded={expanded}
          >
            {expanded ? 'Hide replies' : 'Replies'}
          </QButton>

          {resolved ? null : (
            <CapabilityGate storyId={storyId} action={POLICY_ACTIONS.StoryComment}>
              <QButton variant="ghost" size="sm" onClick={() => setReplying((open) => !open)}>
                Reply
              </QButton>
            </CapabilityGate>
          )}

          {resolved ? null : (
            <CapabilityGate storyId={storyId} action={POLICY_ACTIONS.CommentResolve}>
              <QButton
                variant="ghost"
                size="sm"
                loading={resolveComment.isPending}
                onClick={() => resolveComment.mutate(comment.id)}
              >
                Resolve
              </QButton>
            </CapabilityGate>
          )}

          <CapabilityGate storyId={storyId} action={POLICY_ACTIONS.CommentDelete}>
            <QButton
              variant="ghost"
              size="sm"
              loading={deleteComment.isPending}
              onClick={() => deleteComment.mutate(comment.id)}
            >
              Delete
            </QButton>
          </CapabilityGate>
        </footer>

        {expanded ? (
          <ul className="border-line flex flex-col gap-3 border-t pt-3">
            {thread.isLoading ? (
              <li className="text-ink-muted text-sm">Loading replies…</li>
            ) : replies.length === 0 ? (
              <li className="text-ink-muted text-sm">No replies yet.</li>
            ) : (
              replies.map((item) => (
                <li key={item.id} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between gap-2">
                    <CollaboratorIdentity userId={item.authorId} />
                    <span className="text-ink-muted text-xs">
                      {formatRelativeTime(item.createdAt)}
                    </span>
                  </div>
                  <p className="text-ink ps-10 text-sm whitespace-pre-wrap">
                    <bdi>{item.body}</bdi>
                  </p>
                </li>
              ))
            )}
          </ul>
        ) : null}

        {replying ? (
          <CommentComposer
            dense
            placeholder="Write a reply…"
            submitLabel="Reply"
            isPending={reply.isPending}
            onCancel={() => setReplying(false)}
            onSubmit={async (body) => {
              await reply.mutateAsync({ commentId: comment.id, body });
              setReplying(false);
              setExpanded(true);
            }}
          />
        ) : null}
      </article>
    </QCard>
  );
}
