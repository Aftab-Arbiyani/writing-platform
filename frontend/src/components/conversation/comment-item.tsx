import { QAvatar, QButton, useConfirm, useToast } from '@qalam/ui';
import { type ReactElement, useState } from 'react';
import { Link } from 'react-router';

import { useMe } from '@/hooks/use-me';
import { useCommentActions, useCommentReplies } from '@/hooks/use-piece-comments';
import { getErrorMessage } from '@/lib/errors';
import { formatRelativeTime } from '@/lib/format';
import { mediaUrl } from '@/lib/media';
import { profilePath } from '@/lib/routes';
import { useAuthStore } from '@/stores/auth.store';
import type { PieceComment } from '@/types/conversation';

import { CommentComposer } from './comment-composer';

/**
 * One node of a piece's comment thread (W7a, docs/45 §4.4) — byline, body, a quiet action row,
 * an inline reply/edit composer, and (for a top-level comment) its lazily-loaded replies.
 *
 * **Three honest states this deliberately does not paper over:**
 *
 * 1. **Tombstone.** `isDeleted` means the row survives and `body` IS the server's tombstone text.
 *    The row is RENDERED, not filtered: replies hang off a deleted parent and vanish with it if a
 *    client drops it. Its actions go away — there is nothing left to reply to, edit or delete.
 * 2. **`author: null`.** The DTO allows a node with no person behind it. It renders as "Someone",
 *    which is what is true, rather than a blank byline or a fabricated name.
 * 3. **Not yours.** Edit and delete appear only for your own comment, matched on `username` — the
 *    one identity field both `CommentAuthorDto` and `GET /me` carry. The server re-checks
 *    ownership on both routes regardless.
 *
 * **Replies are one indent level deep.** The server nests to `MAX_COMMENT_DEPTH` (3), but a reply
 * to a reply is rendered flat under the same top-level parent rather than indented again — the
 * same flattening mobile's `comment_tile.dart` does, for the same readability reason.
 *
 * **No report action** — that is W7b, deliberately not this slice, even though mobile's report
 * sheet sits beside its comment widgets.
 */
export interface CommentItemProps {
  pieceId: string;
  comment: PieceComment;
  /** True when rendered inside a parent's replies list (indents, and drops the reply affordance). */
  isReply?: boolean;
}

export function CommentItem({ pieceId, comment, isReply = false }: CommentItemProps): ReactElement {
  const [expanded, setExpanded] = useState(false);
  const [replying, setReplying] = useState(false);
  const [editing, setEditing] = useState(false);

  const authed = useAuthStore((s) => s.status) === 'authenticated';
  const me = useMe();
  const confirm = useConfirm();
  const toast = useToast();
  const { reply, editComment, deleteComment } = useCommentActions(pieceId);
  const replies = useCommentReplies(comment.id, expanded && !isReply);

  // Own vs. other, by username — the only identity both sides of this wire carry. A tombstone is
  // nobody's: its author is null, so there is nothing to own and nothing left to act on.
  const isOwn =
    !comment.isDeleted && comment.author !== null && me.data?.username === comment.author.username;

  const displayName = comment.author
    ? (comment.author.penName ?? `@${comment.author.username}`)
    : 'Someone';
  const avatar = mediaUrl(comment.author?.avatarKey);
  const replyRows = replies.data?.pages.flatMap((page) => page.items) ?? [];

  const onDelete = async (): Promise<void> => {
    const confirmed = await confirm({
      title: 'Delete this comment?',
      content: 'It will be replaced by a placeholder. Any replies to it stay visible.',
      okText: 'Delete',
      cancelText: 'Keep',
      danger: true,
    });
    if (!confirmed) return;
    deleteComment.mutate(
      { commentId: comment.id, parentId: comment.parentId },
      {
        onError: (err) => {
          toast.error('Couldn’t delete this comment', { description: getErrorMessage(err) });
        },
      },
    );
  };

  return (
    <article
      className={isReply ? 'border-line flex flex-col gap-2 border-s ps-4' : 'flex flex-col gap-2'}
      aria-label={comment.isDeleted ? 'Deleted comment' : `Comment by ${displayName}`}
    >
      <header className="flex flex-wrap items-center gap-2">
        <QAvatar size={isReply ? 24 : 32} src={avatar} name={displayName} />
        {comment.author ? (
          <Link
            to={profilePath(comment.author.username)}
            className="text-ink text-sm font-medium hover:underline"
          >
            <bdi>{displayName}</bdi>
          </Link>
        ) : (
          // No profile to link to. Saying so is the honest render; a dead link is not.
          <span className="text-ink-secondary text-sm font-medium">{displayName}</span>
        )}
        <span className="text-ink-muted text-xs">
          <time dateTime={comment.createdAt}>{formatRelativeTime(comment.createdAt)}</time>
        </span>
        {comment.editedAt !== null && !comment.isDeleted ? (
          <span className="text-ink-muted text-xs">
            · edited <time dateTime={comment.editedAt}>{formatRelativeTime(comment.editedAt)}</time>
          </span>
        ) : null}
      </header>

      {editing && isOwn ? (
        <CommentComposer
          dense
          autoFocus
          label="Edit your comment"
          placeholder="Edit your comment…"
          submitLabel="Save"
          initialBody={comment.body}
          isPending={editComment.isPending}
          onCancel={() => setEditing(false)}
          onSubmit={async (body) => {
            try {
              await editComment.mutateAsync({
                commentId: comment.id,
                body,
                parentId: comment.parentId,
              });
              setEditing(false);
            } catch (err) {
              toast.error('Couldn’t save your edit', { description: getErrorMessage(err) });
              throw err; // keeps the typed text in the composer
            }
          }}
        />
      ) : (
        <p
          className={
            comment.isDeleted
              ? 'text-ink-muted text-sm italic whitespace-pre-wrap'
              : 'text-ink text-sm whitespace-pre-wrap'
          }
        >
          <bdi>{comment.body}</bdi>
        </p>
      )}

      {/* A tombstone has no actions: nothing to reply to, edit, or delete. */}
      {comment.isDeleted ? null : (
        <footer className="flex flex-wrap items-center gap-1">
          {authed && !isReply ? (
            <QButton variant="ghost" size="sm" onClick={() => setReplying((open) => !open)}>
              Reply
            </QButton>
          ) : null}
          {isOwn ? (
            <QButton variant="ghost" size="sm" onClick={() => setEditing((open) => !open)}>
              Edit
            </QButton>
          ) : null}
          {isOwn ? (
            <QButton
              variant="ghost"
              size="sm"
              loading={deleteComment.isPending}
              onClick={() => {
                void onDelete();
              }}
            >
              Delete
            </QButton>
          ) : null}
        </footer>
      )}

      {replying && authed && !isReply ? (
        <CommentComposer
          dense
          autoFocus
          label={`Reply to ${displayName}`}
          placeholder="Write a reply…"
          // "Post reply", not "Reply": the footer toggle that OPENED this box is already named
          // "Reply", and two buttons with one accessible name is ambiguous to a screen reader
          // reading the thread as much as it is to a test asserting on it.
          submitLabel="Post reply"
          isPending={reply.isPending}
          onCancel={() => setReplying(false)}
          onSubmit={async (body) => {
            try {
              await reply.mutateAsync({ commentId: comment.id, body });
              setReplying(false);
              setExpanded(true); // land the writer on what they just wrote
            } catch (err) {
              toast.error('Couldn’t post your reply', { description: getErrorMessage(err) });
              throw err;
            }
          }}
        />
      ) : null}

      {/* Replies: driven by `replyCount`, fetched only on expand. Kept mounted once expanded so a
          new reply has somewhere to appear even when the count started at zero. */}
      {!isReply && (comment.replyCount > 0 || expanded) ? (
        <div className="flex flex-col gap-3">
          <div>
            <QButton
              variant="ghost"
              size="sm"
              aria-expanded={expanded}
              onClick={() => setExpanded((open) => !open)}
            >
              {expanded
                ? 'Hide replies'
                : comment.replyCount === 1
                  ? '1 reply'
                  : `${String(comment.replyCount)} replies`}
            </QButton>
          </div>

          {expanded ? (
            <ul className="ms-4 flex list-none flex-col gap-4 p-0">
              {replies.isLoading ? (
                <li className="text-ink-muted text-sm">Loading replies…</li>
              ) : replies.isError ? (
                <li className="text-ink-muted text-sm">
                  Couldn’t load replies. {getErrorMessage(replies.error)}
                </li>
              ) : replyRows.length === 0 ? (
                <li className="text-ink-muted text-sm">No replies yet.</li>
              ) : (
                replyRows.map((row) => (
                  <li key={row.id}>
                    <CommentItem pieceId={pieceId} comment={row} isReply />
                  </li>
                ))
              )}
              {replies.hasNextPage ? (
                <li>
                  <QButton
                    variant="ghost"
                    size="sm"
                    loading={replies.isFetchingNextPage}
                    onClick={() => {
                      void replies.fetchNextPage();
                    }}
                  >
                    More replies
                  </QButton>
                </li>
              ) : null}
            </ul>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
