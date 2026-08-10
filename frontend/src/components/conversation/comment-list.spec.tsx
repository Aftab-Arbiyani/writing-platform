import { COMMENT_MAX_LENGTH, Role } from '@qalam/shared';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api-client';
import { conversationApi } from '@/lib/conversation-api';
import { useAuthStore } from '@/stores/auth.store';
import { renderWithProviders } from '@/test/render';
import type { PieceComment } from '@/types/conversation';

import { CommentList } from './comment-list';

vi.mock('@/lib/conversation-api');
vi.mock('@/hooks/use-me', () => ({ useMe: vi.fn() }));

const { useMe } = await import('@/hooks/use-me');
const me = vi.mocked(useMe);
const comments = vi.mocked(conversationApi.comments);
const addComment = vi.mocked(conversationApi.addComment);
const replies = vi.mocked(conversationApi.replies);

const PIECE_ID = 'piece-1';
const RETURN_TO = '/p/rain-over-the-old-city';

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

function page(items: PieceComment[], nextCursor: string | null = null) {
  return { items, meta: { nextCursor, hasMore: nextCursor !== null } };
}

describe('CommentList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.getState().clear();
    me.mockReturnValue({ data: undefined } as unknown as ReturnType<typeof useMe>);
    comments.mockResolvedValue(page([]));
    replies.mockResolvedValue(page([]));
  });

  function signIn(username = 'meera_k'): void {
    useAuthStore.getState().setSession({ accessToken: 'token', role: Role.User });
    me.mockReturnValue({ data: { username } } as unknown as ReturnType<typeof useMe>);
  }

  /**
   * The read is `@Public()`. A signed-out reader MUST see the thread — gating a public page's read
   * on auth is the W5-6 defect, where the 401 cleared the cache and broke the page for everyone
   * (48 §3.9). This asserts reachability, not just that a request was shaped right.
   */
  it('shows the thread to a signed-out reader and offers sign-in instead of a composer', async () => {
    comments.mockResolvedValue(page([comment()]));
    renderWithProviders(<CommentList pieceId={PIECE_ID} returnTo={RETURN_TO} />);

    expect(await screen.findByText('The last paragraph undid me.')).toBeInTheDocument();
    expect(screen.queryByLabelText('Add a comment')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute(
      'href',
      `/auth/login?returnTo=${encodeURIComponent(RETURN_TO)}`,
    );
  });

  it('reads the comments without any session at all', async () => {
    renderWithProviders(<CommentList pieceId={PIECE_ID} returnTo={RETURN_TO} />);
    await waitFor(() => {
      expect(comments).toHaveBeenCalledWith(PIECE_ID, undefined, expect.anything());
    });
  });

  it('renders an empty thread as an invitation, not an error', async () => {
    renderWithProviders(<CommentList pieceId={PIECE_ID} returnTo={RETURN_TO} />);
    expect(await screen.findByText(/No comments yet/)).toBeInTheDocument();
  });

  it('surfaces a failed read with a retry rather than an empty thread', async () => {
    comments.mockRejectedValue(
      new ApiError(500, { code: 'API_UNEXPECTED_ERROR', message: 'Boom.' }),
    );
    renderWithProviders(<CommentList pieceId={PIECE_ID} returnTo={RETURN_TO} />);

    expect(await screen.findByText('Couldn’t load the comments.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry|try again/i })).toBeInTheDocument();
  });

  it('posts a comment as `{ body }` — the whole of CreateCommentDto', async () => {
    signIn();
    addComment.mockResolvedValue(comment({ id: 'c-new' }));
    renderWithProviders(<CommentList pieceId={PIECE_ID} returnTo={RETURN_TO} />);

    fireEvent.change(await screen.findByLabelText('Add a comment'), {
      target: { value: '  A fine ending.  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Comment' }));

    await waitFor(() => {
      expect(addComment).toHaveBeenCalledWith(PIECE_ID, 'A fine ending.');
    });
  });

  it('refuses to submit an empty comment', async () => {
    signIn();
    renderWithProviders(<CommentList pieceId={PIECE_ID} returnTo={RETURN_TO} />);
    expect(await screen.findByRole('button', { name: 'Comment' })).toBeDisabled();
  });

  /** The bound is the SHARED constant, so the client's refusal and the DTO's cannot drift. */
  it('refuses a body past COMMENT_MAX_LENGTH and says why', async () => {
    signIn();
    renderWithProviders(<CommentList pieceId={PIECE_ID} returnTo={RETURN_TO} />);

    fireEvent.change(await screen.findByLabelText('Add a comment'), {
      target: { value: 'x'.repeat(COMMENT_MAX_LENGTH + 1) },
    });

    expect(screen.getByRole('button', { name: 'Comment' })).toBeDisabled();
    expect(
      screen.getByText(`Keep it under ${COMMENT_MAX_LENGTH.toLocaleString('en')} characters.`),
    ).toBeInTheDocument();
    expect(addComment).not.toHaveBeenCalled();
  });

  /** A tombstone stays in the list — filtering it out would take its replies with it. */
  it('keeps a deleted comment in the list, with its replies still reachable', async () => {
    comments.mockResolvedValue(
      page([
        comment({
          isDeleted: true,
          author: null,
          body: 'This comment has been deleted.',
          replyCount: 1,
        }),
      ]),
    );
    replies.mockResolvedValue(
      page([comment({ id: 'c-2', parentId: 'c-1', depth: 2, body: 'The reply survived.' })]),
    );

    renderWithProviders(<CommentList pieceId={PIECE_ID} returnTo={RETURN_TO} />);
    fireEvent.click(await screen.findByRole('button', { name: '1 reply' }));

    expect(await screen.findByText('The reply survived.')).toBeInTheDocument();
    expect(screen.getByText('This comment has been deleted.')).toBeInTheDocument();
  });

  it('pages with the server’s cursor', async () => {
    comments.mockResolvedValueOnce(page([comment({ id: 'c-1' })], 'cursor-2'));
    comments.mockResolvedValueOnce(page([comment({ id: 'c-2', body: 'Second page.' })]));

    renderWithProviders(<CommentList pieceId={PIECE_ID} returnTo={RETURN_TO} />);
    fireEvent.click(await screen.findByRole('button', { name: 'More comments' }));

    expect(await screen.findByText('Second page.')).toBeInTheDocument();
    expect(comments).toHaveBeenLastCalledWith(PIECE_ID, 'cursor-2', expect.anything());
  });
});
