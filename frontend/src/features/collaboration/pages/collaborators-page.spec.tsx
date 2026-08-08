import { POLICY_ACTIONS, PolicyEffect, StoryRole } from '@qalam/shared';
import { screen, waitFor } from '@testing-library/react';
import type * as ReactRouter from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/test/render';

import { collaborationApi } from '../api/collaboration.api';
import type { CollaboratorLimit } from '../types/collaboration.types';
import { CollaboratorsPage } from './collaborators-page';

vi.mock('../api/collaboration.api');
vi.mock('../lib/collaboration-enabled');
vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof ReactRouter>('react-router');
  return { ...actual, useParams: () => ({ storyId: 'story-1' }) };
});

const { isCollaborationEnabled } = await import('../lib/collaboration-enabled');
const enabled = vi.mocked(isCollaborationEnabled);
const members = vi.mocked(collaborationApi.members);
const storyInvitations = vi.mocked(collaborationApi.storyInvitations);
const presence = vi.mocked(collaborationApi.presence);
const capabilities = vi.mocked(collaborationApi.capabilities);
const collaboratorLimit = vi.mocked(collaborationApi.collaboratorLimit);

function seats(over: Partial<CollaboratorLimit> = {}): CollaboratorLimit {
  return {
    storyId: 'story-1',
    members: 0,
    pendingInvitations: 0,
    used: 0,
    limit: 3,
    remaining: 3,
    unlimited: false,
    canInvite: true,
    ...over,
  };
}

/**
 * B6's client half (docs/45 §4.11), asserted through the page a writer actually sees.
 *
 * These are REACHABILITY tests, not wire-shape tests. The repeated defect class in this codebase
 * (R-1, M5-1, W5-3, W8-1) is client code that looks wired and is not, so every case here mounts
 * the real page and asks what is on screen — a seat count that is fetched but never rendered, or
 * an upsell behind a gate that never opens, fails here and would pass a shape test.
 */
describe('CollaboratorsPage — B6 seats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    enabled.mockReturnValue(true);
    members.mockResolvedValue([
      { userId: 'owner-1', role: StoryRole.Owner, invitedById: null, joinedAt: null },
    ]);
    storyInvitations.mockResolvedValue([]);
    presence.mockResolvedValue([]);
    capabilities.mockResolvedValue({
      storyId: 'story-1',
      capabilities: [
        {
          action: POLICY_ACTIONS.StoryInvite,
          effect: PolicyEffect.Allow,
          allowed: true,
          reason: 'owner',
          obligations: [],
        },
      ],
    });
    collaboratorLimit.mockResolvedValue(seats());
  });

  it('shows the seat count beside the invite action, before the wall', async () => {
    collaboratorLimit.mockResolvedValue(
      seats({ members: 2, used: 2, remaining: 1, canInvite: true }),
    );

    renderWithProviders(<CollaboratorsPage />);

    expect(await screen.findByText('2 of 3 collaborators')).toBeInTheDocument();
    // Still usable — the count is information, not a refusal.
    expect(screen.getByRole('button', { name: 'Invite' })).toBeEnabled();
  });

  /**
   * The C-1 defect, restated as a test: mobile's gate hid the affordance and a free user could not
   * tell the feature existed. A free author here must SEE the invite control, see that it is off,
   * and be told what collaboration is and what it costs.
   */
  it('a FREE author sees the invite action, disabled, with an honest upsell — never a hidden one', async () => {
    collaboratorLimit.mockResolvedValue(
      seats({ limit: 0, remaining: 0, canInvite: false, unlimited: false }),
    );

    renderWithProviders(<CollaboratorsPage />);

    const invite = await screen.findByRole('button', { name: 'Invite' });
    expect(invite).toBeInTheDocument(); // not hidden — C-1
    expect(invite).toBeDisabled(); // not a live button that 402s — W3c-1

    expect(screen.getByText('Collaboration isn’t included in your plan.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'See plans' })).toBeInTheDocument();

    // The disabled control explains itself to a screen reader rather than just going quiet.
    const describedBy = invite.getAttribute('aria-describedby');
    expect(describedBy).not.toBeNull();
    expect(document.getElementById(describedBy ?? '')).toHaveTextContent(
      /Plus includes 3 collaborators/,
    );
  });

  it('a full PLUS story is blocked with the remedies that exist, and no reset', async () => {
    collaboratorLimit.mockResolvedValue(
      seats({ members: 3, used: 3, remaining: 0, canInvite: false }),
    );

    renderWithProviders(<CollaboratorsPage />);

    expect(
      await screen.findByText('You’ve used all 3 collaborators on this story.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Invite' })).toBeDisabled();
    expect(screen.queryByText(/resets|try again later/i)).not.toBeInTheDocument();
  });

  it('an UNLIMITED story shows no count and no notice', async () => {
    collaboratorLimit.mockResolvedValue(
      seats({ members: 9, used: 9, limit: -1, remaining: null, unlimited: true, canInvite: true }),
    );

    renderWithProviders(<CollaboratorsPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Invite' })).toBeEnabled();
    });
    expect(screen.queryByText(/of .* collaborators/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'See plans' })).not.toBeInTheDocument();
  });

  it('asks for the allowance of the story on screen', async () => {
    renderWithProviders(<CollaboratorsPage />);
    await waitFor(() => {
      expect(collaboratorLimit).toHaveBeenCalledWith('story-1', expect.anything());
    });
  });

  it('makes no seat request while the collaboration flag is off', async () => {
    enabled.mockReturnValue(false);

    renderWithProviders(<CollaboratorsPage />);

    expect(await screen.findByText('Collaboration is off')).toBeInTheDocument();
    expect(collaboratorLimit).not.toHaveBeenCalled();
  });

  it('hides the seat surface entirely from a viewer who cannot invite', async () => {
    // The route is `story.invite`-authorized: a reader would only get a 403, and an upsell aimed
    // at someone who does not own the story is addressed to the wrong person.
    capabilities.mockResolvedValue({ storyId: 'story-1', capabilities: [] });
    collaboratorLimit.mockResolvedValue(seats({ limit: 0, remaining: 0, canInvite: false }));

    renderWithProviders(<CollaboratorsPage />);

    await screen.findByText('Collaborators');
    expect(screen.queryByRole('button', { name: 'Invite' })).not.toBeInTheDocument();
    expect(
      screen.queryByText('Collaboration isn’t included in your plan.'),
    ).not.toBeInTheDocument();
  });
});
