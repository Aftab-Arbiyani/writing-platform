import { InvitationStatus, StoryRole } from '@qalam/shared';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/test/render';

import { collaborationApi } from '../api/collaboration.api';
import type { StoryInvitation } from '../types/collaboration.types';
import { InvitationsInboxPage } from './invitations-inbox-page';

vi.mock('../api/collaboration.api');
vi.mock('../lib/collaboration-enabled');

const { isCollaborationEnabled } = await import('../lib/collaboration-enabled');
const enabled = vi.mocked(isCollaborationEnabled);
const myInvitations = vi.mocked(collaborationApi.myInvitations);
const accept = vi.mocked(collaborationApi.accept);

function invitation(over: Partial<StoryInvitation> = {}): StoryInvitation {
  return {
    id: 'inv-1',
    storyId: 'story-1',
    inviterId: 'user-1',
    inviteeId: 'user-2',
    role: StoryRole.Editor,
    status: InvitationStatus.Pending,
    expiresAt: new Date(Date.now() + 3 * 86_400_000).toISOString(),
    respondedAt: null,
    createdAt: new Date().toISOString(),
    ...over,
  };
}

describe('InvitationsInboxPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    enabled.mockReturnValue(true);
  });

  it('offers accept and decline on a pending invitation', async () => {
    myInvitations.mockResolvedValue([invitation()]);
    // Accept answers with the new MEMBER, not the invitation — the real contract shape.
    accept.mockResolvedValue({
      userId: 'user-2',
      role: StoryRole.Editor,
      invitedById: 'user-1',
      joinedAt: new Date().toISOString(),
    });

    renderWithProviders(<InvitationsInboxPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Accept' }));

    await waitFor(() => {
      expect(accept).toHaveBeenCalledWith('inv-1');
    });
  });

  it('shows an expiry hint so a stale invitation is obvious', async () => {
    myInvitations.mockResolvedValue([invitation()]);

    renderWithProviders(<InvitationsInboxPage />);

    expect(await screen.findByText(/Expires in 2 days|Expires in 3 days/)).toBeInTheDocument();
  });

  it('shows no accept/decline on a non-pending invitation', async () => {
    // `/me/invitations` is pending-only in practice (`listMine` filters), so this is defensive:
    // if a settled row ever arrives it must render as a status, never as an actionable row.
    // An earlier version of this test asserted an "Earlier" history section — that section could
    // never populate from this endpoint and has been removed.
    myInvitations.mockResolvedValue([
      invitation({ id: 'inv-2', status: InvitationStatus.Declined }),
    ]);

    renderWithProviders(<InvitationsInboxPage />);

    expect(await screen.findByText('Declined')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Accept' })).not.toBeInTheDocument();
    expect(screen.queryByText('Earlier')).not.toBeInTheDocument();
  });

  it('says so when there is nothing waiting', async () => {
    myInvitations.mockResolvedValue([]);

    renderWithProviders(<InvitationsInboxPage />);

    expect(await screen.findByText('No invitations')).toBeInTheDocument();
  });

  it('renders the dark-launch state and makes no request when the flag is off', () => {
    enabled.mockReturnValue(false);

    renderWithProviders(<InvitationsInboxPage />);

    expect(screen.getByText('Collaboration is off')).toBeInTheDocument();
    // The kill switch must actually stop the traffic, not just hide the list.
    expect(myInvitations).not.toHaveBeenCalled();
  });
});
