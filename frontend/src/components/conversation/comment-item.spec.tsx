import { Role } from '@qalam/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { conversationApi } from '@/lib/conversation-api';
import { useAuthStore } from '@/stores/auth.store';
import { renderWithProviders } from '@/test/render';
import type { PieceComment } from '@/types/conversation';

import { CommentItem } from './comment-item';

vi.mock('@/lib/conversation-api');
vi.mock('@/hooks/use-me', () => ({ useMe: vi.fn() }));

const { useMe } = await import('@/hooks/use-me');
const me = vi.mocked(useMe);
const replies = vi.mocked(conversationApi.replies);
const reply = vi.mocked(conversationApi.reply);
const editComment = vi.mocked(conversationApi.editComment);
const deleteComment = vi.mocked(conversationApi.deleteComment);

const PIECE_ID = 'piece-1';

function comment(over: Partial<PieceComment> = {}): PieceComment {
  return {
    id: 'c-1',
    parentId: null,
    depth: 1,
    author: { username: 'meera_k', penName: 'Meera K', avatarKey: null },
    body: 'The last paragraph undid me.',
    isDeleted: false,
    replyCount: 0,
    editedAt: null,
    createdAt: new Date('2026-08-09T10:00:00Z').toISOString(),
    updatedAt: new Date('2026-08-09T10:00:00Z').toISOString(),
    ...over,
  };
}

/** `useMe` answering as a given username — how ownership is decided (the only shared identity). */
function signedInAs(username: string | null): void {
  useAuthStore.getState().setSession({ accessToken: 'token', role: Role.User });
  me.mockReturnValue({
    data: username === null ? undefined : { username },
  } as unknown as ReturnType<typeof useMe>);
}

function signedOut(): void {
  useAuthStore.getState().clear();
  me.mockReturnValue({ data: undefined } as unknown as ReturnType<typeof useMe>);
}

function page(items: PieceComment[]) {
  return { items, meta: { nextCursor: null, hasMore: false } };
}

describe('CommentItem', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    signedInAs('meera_k');
    replies.mockResolvedValue(page([]));
  });

  it('names the author from the embedded author block — no by-id lookup needed', () => {
    renderWithProviders(<CommentItem pieceId={PIECE_ID} comment={comment()} />);
    expect(screen.getByText('Meera K')).toBeInTheDocument();
    expect(screen.getByText('The last paragraph undid me.')).toBeInTheDocument();
  });

  it('falls back to the handle when the author has no pen name', () => {
    renderWithProviders(
      <CommentItem
        pieceId={PIECE_ID}
        comment={comment({ author: { username: 'meera_k', penName: null, avatarKey: null } })}
      />,
    );
    expect(screen.getByText('@meera_k')).toBeInTheDocument();
  });

  /** `author: null` is allowed by the DTO. It must read as unknown, not as blank or invented. */
  it('renders a null author honestly and links nowhere', () => {
    renderWithProviders(<CommentItem pieceId={PIECE_ID} comment={comment({ author: null })} />);
    expect(screen.getByText('Someone')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  /**
   * The tombstone case, and the reason it matters: replies hang off a deleted parent, so a client
   * that hides the row takes the replies with it.
   */
  it('renders a deleted comment’s tombstone row and offers no actions on it', () => {
    renderWithProviders(
      <CommentItem
        pieceId={PIECE_ID}
        comment={comment({
          isDeleted: true,
          author: null,
          body: 'This comment has been deleted.',
          replyCount: 2,
        })}
      />,
    );
    expect(screen.getByText('This comment has been deleted.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reply' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
    // The replies affordance survives — that is the whole point of keeping the node.
    expect(screen.getByRole('button', { name: '2 replies' })).toBeInTheDocument();
  });

  it('shows that a comment was edited', () => {
    renderWithProviders(
      <CommentItem
        pieceId={PIECE_ID}
        comment={comment({ editedAt: new Date('2026-08-09T11:00:00Z').toISOString() })}
      />,
    );
    expect(screen.getByText(/edited/)).toBeInTheDocument();
  });

  it('offers edit and delete on your own comment', () => {
    renderWithProviders(<CommentItem pieceId={PIECE_ID} comment={comment()} />);
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
  });

  it('offers neither on someone else’s comment', () => {
    signedInAs('other_reader');
    renderWithProviders(<CommentItem pieceId={PIECE_ID} comment={comment()} />);
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
    // …but a signed-in reader may still reply.
    expect(screen.getByRole('button', { name: 'Reply' })).toBeInTheDocument();
  });

  it('offers no write affordance at all to a signed-out reader', () => {
    signedOut();
    renderWithProviders(<CommentItem pieceId={PIECE_ID} comment={comment()} />);
    expect(screen.queryByRole('button', { name: 'Reply' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
  });

  /**
   * Replies come from `GET /comments/:id/replies`, and ONLY on expand — `CommentResponseDto` has no
   * `replies` array, and a page of forty comments must not fire forty requests to render.
   */
  it('does not fetch replies until the thread is expanded', async () => {
    renderWithProviders(<CommentItem pieceId={PIECE_ID} comment={comment({ replyCount: 1 })} />);
    expect(replies).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: '1 reply' }));
    await waitFor(() => {
      expect(replies).toHaveBeenCalledWith('c-1', undefined, expect.anything());
    });
  });

  it('nests a loaded reply under its parent', async () => {
    replies.mockResolvedValue(
      page([
        comment({
          id: 'c-2',
          parentId: 'c-1',
          depth: 2,
          body: 'Agreed — the ending is the whole piece.',
          author: { username: 'zara', penName: 'Zara', avatarKey: null },
        }),
      ]),
    );

    renderWithProviders(<CommentItem pieceId={PIECE_ID} comment={comment({ replyCount: 1 })} />);
    fireEvent.click(screen.getByRole('button', { name: '1 reply' }));

    expect(await screen.findByText('Agreed — the ending is the whole piece.')).toBeInTheDocument();
    // A reply carries no reply affordance of its own — replies are flattened to one indent level.
    const nested = screen.getByLabelText('Comment by Zara');
    expect(nested.querySelector('button')).toBeNull();
  });

  it('posts a reply to the reply endpoint, with the parent in the URL and only a body', async () => {
    reply.mockResolvedValue(comment({ id: 'c-2', parentId: 'c-1', depth: 2 }));
    renderWithProviders(<CommentItem pieceId={PIECE_ID} comment={comment()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Reply' }));
    fireEvent.change(screen.getByLabelText('Reply to Meera K'), {
      target: { value: '  Yes, exactly.  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Post reply' }));

    await waitFor(() => {
      expect(reply).toHaveBeenCalledWith('c-1', 'Yes, exactly.');
    });
  });

  it('edits through PATCH /comments/:id, prefilled with the current body', async () => {
    editComment.mockResolvedValue(comment({ body: 'Reworded.' }));
    renderWithProviders(<CommentItem pieceId={PIECE_ID} comment={comment()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    const field = screen.getByLabelText('Edit your comment');
    expect(field).toHaveValue('The last paragraph undid me.');

    fireEvent.change(field, { target: { value: 'Reworded.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(editComment).toHaveBeenCalledWith('c-1', 'Reworded.');
    });
  });

  it('deletes only after the reader confirms, and says the replies survive', async () => {
    deleteComment.mockResolvedValue(undefined);
    renderWithProviders(<CommentItem pieceId={PIECE_ID} comment={comment()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    // The confirm has to be honest about the outcome: this is a soft delete, so the row becomes a
    // placeholder and any replies stay reachable. A reader told "this can't be undone" and nothing
    // else would reasonably expect the replies to go too.
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent(/replies to it stay visible/i);
    expect(deleteComment).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole('button', { name: /^Delete$/ }));
    await waitFor(() => {
      expect(deleteComment).toHaveBeenCalledWith('c-1');
    });
  });

  it('cancelling the confirm deletes nothing', async () => {
    renderWithProviders(<CommentItem pieceId={PIECE_ID} comment={comment()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: /keep/i }));

    expect(deleteComment).not.toHaveBeenCalled();
  });
});
