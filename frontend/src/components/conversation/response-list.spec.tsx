import { Role } from '@qalam/shared';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import type * as ReactRouter from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api-client';
import { conversationApi } from '@/lib/conversation-api';
import { useAuthStore } from '@/stores/auth.store';
import { renderWithProviders } from '@/test/render';
import type { PieceResponse } from '@/types/conversation';

import { ResponseList } from './response-list';

vi.mock('@/lib/conversation-api');

// The write flow's observable end is a NAVIGATION to the editor, so the router's navigate is the
// seam under test. `MemoryRouter` (test/render) still provides the Link context around it.
const navigate = vi.fn();
vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof ReactRouter>('react-router');
  return { ...actual, useNavigate: () => navigate };
});

const responses = vi.mocked(conversationApi.responses);
const createResponse = vi.mocked(conversationApi.createResponse);

const PIECE_ID = 'piece-1';
const RETURN_TO = '/p/rain-over-the-old-city';

function response(over: Partial<PieceResponse> = {}): PieceResponse {
  return {
    pieceId: 'piece-2',
    slug: 'an-answering-piece',
    title: 'An answering piece',
    subtitle: 'Written after the rain',
    author: { username: 'zara', penName: 'Zara' },
    publishedAt: new Date('2026-08-09T09:00:00Z').toISOString(),
    respondedAt: new Date('2026-08-09T09:00:00Z').toISOString(),
    ...over,
  };
}

function page(items: PieceResponse[], nextCursor: string | null = null) {
  return { items, meta: { nextCursor, hasMore: nextCursor !== null } };
}

function props() {
  return {
    pieceId: PIECE_ID,
    languageCode: 'ur',
    parentTitle: 'Rain over the old city',
    returnTo: RETURN_TO,
  };
}

describe('ResponseList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.getState().clear();
    responses.mockResolvedValue(page([]));
  });

  function signIn(role: Role = Role.User): void {
    useAuthStore.getState().setSession({ accessToken: 'token', role });
  }

  /**
   * `GET /pieces/:id/responses` is `@Public()` + `OptionalAuthGuard`. Gating the read is the W5-6
   * defect (48 §3.9) — so this asserts the signed-out reader actually SEES the list.
   */
  it('shows responses to a signed-out reader, with an honest sign-in affordance', async () => {
    responses.mockResolvedValue(page([response()]));
    renderWithProviders(<ResponseList {...props()} />);

    expect(await screen.findByRole('link', { name: 'An answering piece' })).toHaveAttribute(
      'href',
      '/p/an-answering-piece',
    );
    expect(screen.queryByRole('button', { name: 'Write a response' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute(
      'href',
      `/auth/login?returnTo=${encodeURIComponent(RETURN_TO)}`,
    );
  });

  it('links an unpublished response by its id, since it has no slug', async () => {
    responses.mockResolvedValue(page([response({ slug: null })]));
    renderWithProviders(<ResponseList {...props()} />);
    expect(await screen.findByRole('link', { name: 'An answering piece' })).toHaveAttribute(
      'href',
      '/p/piece-2',
    );
  });

  it('renders an empty list as an invitation', async () => {
    renderWithProviders(<ResponseList {...props()} />);
    expect(await screen.findByText(/No responses yet/)).toBeInTheDocument();
  });

  it('surfaces a failed read with a retry', async () => {
    responses.mockRejectedValue(
      new ApiError(500, { code: 'API_UNEXPECTED_ERROR', message: 'Boom.' }),
    );
    renderWithProviders(<ResponseList {...props()} />);
    expect(await screen.findByText('Couldn’t load the responses.')).toBeInTheDocument();
  });

  /**
   * The write flow's whole point: a response IS a piece, so `POST` mints a linked DRAFT and the
   * reader is taken to the EDITOR for it — not to an inline composer. This asserts the navigation,
   * because "looked wired and was not" is this codebase's repeated defect class (R-1, M5-1, W5-3).
   */
  it('creates a draft and lands the writer in the editor for it', async () => {
    signIn();
    createResponse.mockResolvedValue({ id: 'draft-9', title: '', slug: null });
    renderWithProviders(<ResponseList {...props()} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Write a response' }));

    await waitFor(() => {
      expect(createResponse).toHaveBeenCalledWith(PIECE_ID, {
        // `CreatePieceDto` requires a language; the parent's is the sensible inheritance.
        languageCode: 'ur',
        title: 'Response to “Rain over the old city”',
      });
    });
    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith('/write/draft-9');
    });
  });

  it('offers the write action to a moderator too — piece.create is inherited', async () => {
    signIn(Role.Moderator);
    renderWithProviders(<ResponseList {...props()} />);
    expect(await screen.findByRole('button', { name: 'Write a response' })).toBeInTheDocument();
  });

  /**
   * `usePermission` is a hint, not enforcement: the server can still refuse — a customized grant or
   * a trust restriction. (NOT B4's piece cap: that gates `POST /pieces` alone, by design, so that a
   * capped author can still answer a piece.) The refusal has to be visible, and the reader must not
   * be navigated anywhere.
   */
  it('surfaces a server refusal and does not navigate', async () => {
    signIn();
    createResponse.mockRejectedValue(
      new ApiError(403, { code: 'AUTH_FORBIDDEN', message: 'You cannot create pieces.' }),
    );
    renderWithProviders(<ResponseList {...props()} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Write a response' }));

    expect(await screen.findByText('Couldn’t start your response')).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('pages with the server’s cursor', async () => {
    responses.mockResolvedValueOnce(page([response()], 'cursor-2'));
    responses.mockResolvedValueOnce(
      page([response({ pieceId: 'piece-3', slug: 'later', title: 'A later response' })]),
    );

    renderWithProviders(<ResponseList {...props()} />);
    fireEvent.click(await screen.findByRole('button', { name: 'More responses' }));

    expect(await screen.findByRole('link', { name: 'A later response' })).toBeInTheDocument();
    expect(responses).toHaveBeenLastCalledWith(PIECE_ID, 'cursor-2', expect.anything());
  });
});
