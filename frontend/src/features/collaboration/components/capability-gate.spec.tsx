import { POLICY_ACTIONS } from '@qalam/shared';
import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/test/render';

import { collaborationApi } from '../api/collaboration.api';
import type { StoryCapabilities } from '../types/collaboration.types';
import { CapabilityGate } from './capability-gate';

vi.mock('../api/collaboration.api');

const capabilities = vi.mocked(collaborationApi.capabilities);

function map(overrides: Partial<StoryCapabilities['capabilities'][number]>[]): StoryCapabilities {
  return {
    storyId: 'story-1',
    capabilities: overrides.map((over) => ({
      action: POLICY_ACTIONS.StoryInvite,
      effect: 'allow',
      allowed: true,
      reason: 'OWNERSHIP',
      obligations: [],
      ...over,
    })),
  };
}

/**
 * The gate's whole job is to fail closed (docs/49 §3). These cases are the four ways it can be
 * asked about something it has no positive answer for — every one of them must render nothing.
 */
describe('CapabilityGate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders children when the server allows the action', async () => {
    capabilities.mockResolvedValue(map([{ allowed: true }]));

    renderWithProviders(
      <CapabilityGate storyId="story-1" action={POLICY_ACTIONS.StoryInvite}>
        <button type="button">Invite</button>
      </CapabilityGate>,
    );

    expect(await screen.findByRole('button', { name: 'Invite' })).toBeInTheDocument();
  });

  it('renders nothing when the server denies the action', async () => {
    capabilities.mockResolvedValue(map([{ allowed: false, effect: 'deny', reason: 'ROLE_RANK' }]));

    renderWithProviders(
      <CapabilityGate storyId="story-1" action={POLICY_ACTIONS.StoryInvite}>
        <button type="button">Invite</button>
      </CapabilityGate>,
    );

    // Wait for the map to settle, then assert absence — otherwise this passes on the loading state.
    await vi.waitFor(() => {
      expect(capabilities).toHaveBeenCalled();
    });
    expect(screen.queryByRole('button', { name: 'Invite' })).not.toBeInTheDocument();
  });

  it('renders nothing while the map is still loading', () => {
    capabilities.mockReturnValue(new Promise(() => {}));

    renderWithProviders(
      <CapabilityGate storyId="story-1" action={POLICY_ACTIONS.StoryInvite}>
        <button type="button">Invite</button>
      </CapabilityGate>,
    );

    expect(screen.queryByRole('button', { name: 'Invite' })).not.toBeInTheDocument();
  });

  it('fails closed when the map cannot be loaded', async () => {
    capabilities.mockRejectedValue(new Error('boom'));

    renderWithProviders(
      <CapabilityGate storyId="story-1" action={POLICY_ACTIONS.StoryInvite}>
        <button type="button">Invite</button>
      </CapabilityGate>,
    );

    await vi.waitFor(() => {
      expect(capabilities).toHaveBeenCalled();
    });
    expect(screen.queryByRole('button', { name: 'Invite' })).not.toBeInTheDocument();
  });

  it('fails closed when the map simply does not mention the action', async () => {
    // The engine returns decisions for the actions it was asked about; an action missing from the
    // map is not an implicit allow.
    capabilities.mockResolvedValue(map([{ action: POLICY_ACTIONS.StoryView, allowed: true }]));

    renderWithProviders(
      <CapabilityGate storyId="story-1" action={POLICY_ACTIONS.StoryManageMembers}>
        <button type="button">Remove</button>
      </CapabilityGate>,
    );

    await vi.waitFor(() => {
      expect(capabilities).toHaveBeenCalled();
    });
    expect(screen.queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument();
  });

  it('renders the fallback instead of nothing when one is given', async () => {
    capabilities.mockResolvedValue(map([{ allowed: false }]));

    renderWithProviders(
      <CapabilityGate
        storyId="story-1"
        action={POLICY_ACTIONS.StoryInvite}
        fallback={<p>Read-only</p>}
      >
        <button type="button">Invite</button>
      </CapabilityGate>,
    );

    expect(await screen.findByText('Read-only')).toBeInTheDocument();
  });
});
