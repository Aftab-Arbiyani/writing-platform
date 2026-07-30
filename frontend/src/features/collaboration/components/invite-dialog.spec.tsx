import { StoryRole } from '@qalam/shared';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api-client';
import type * as ApiClientModule from '@/lib/api-client';
import { renderWithProviders } from '@/test/render';

import { collaborationApi } from '../api/collaboration.api';
import { InviteDialog } from './invite-dialog';

vi.mock('../api/collaboration.api');

// The handle lookup goes through the app-level profile hook, i.e. straight to `get`. Mocking the
// module lets the resolution be driven per test without a server.
vi.mock('@/lib/api-client', async () => {
  const actual = await vi.importActual<typeof ApiClientModule>('@/lib/api-client');
  return { ...actual, get: vi.fn() };
});

const { get } = await import('@/lib/api-client');
const mockGet = vi.mocked(get);
const invite = vi.mocked(collaborationApi.invite);

const PROFILE = {
  id: 'user-42',
  username: 'farheen',
  penName: 'Farheen',
  avatarKey: null,
  isPrivate: false,
  restricted: false,
  counts: {},
  viewerRelation: {},
};

/**
 * These tests exist because of defect **M-1** (docs/48 §3.1): mobile's invite sends an email to an
 * endpoint that only accepts a user id, so every invite 400s. The regression guard here is the
 * `inviteeId` assertion — if someone later "simplifies" this dialog into an email field, this fails.
 */
describe('InviteDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockResolvedValue(PROFILE);
  });

  it('resolves a handle and invites by user id, never by email or handle', async () => {
    invite.mockResolvedValue({
      id: 'inv-1',
      storyId: 'story-1',
      inviterId: 'user-1',
      inviteeId: 'user-42',
      role: StoryRole.Editor,
      status: 'pending',
      expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
      respondedAt: null,
      createdAt: new Date().toISOString(),
    });

    renderWithProviders(<InviteDialog storyId="story-1" open onClose={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('Handle'), { target: { value: '@farheen' } });

    // The resolved person is shown before anything is sent — the confirmation an email box cannot give.
    expect(await screen.findByText(/Farheen/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Send invitation' }));

    await waitFor(() => {
      expect(invite).toHaveBeenCalledWith('story-1', 'user-42', StoryRole.Editor);
    });
    // The contract's shape, asserted explicitly: an id, not the typed handle.
    expect(invite).not.toHaveBeenCalledWith('story-1', 'farheen', expect.anything());
    expect(invite).not.toHaveBeenCalledWith('story-1', '@farheen', expect.anything());
  });

  it('keeps submit disabled until a real writer is resolved', async () => {
    mockGet.mockRejectedValue(new ApiError(404, { code: 'USER_NOT_FOUND', message: 'nope' }));

    renderWithProviders(<InviteDialog storyId="story-1" open onClose={vi.fn()} />);

    const submit = screen.getByRole('button', { name: 'Send invitation' });
    expect(submit).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Handle'), { target: { value: '@ghost' } });

    expect(await screen.findByText('No writer with that handle.')).toBeInTheDocument();
    expect(submit).toBeDisabled();
    expect(invite).not.toHaveBeenCalled();
  });

  it('explains an already-a-collaborator failure in its own words', async () => {
    invite.mockRejectedValue(
      new ApiError(409, { code: 'STORY_MEMBER_EXISTS', message: 'already a member' }),
    );

    renderWithProviders(<InviteDialog storyId="story-1" open onClose={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('Handle'), { target: { value: '@farheen' } });
    await screen.findByText(/Farheen/);
    fireEvent.click(screen.getByRole('button', { name: 'Send invitation' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'They are already a collaborator on this story.',
    );
  });
});
