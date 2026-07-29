import {
  POLICY_ACTIONS,
  PolicyEffect,
  RestrictionScope,
  RestrictionType,
  TrustLevel,
  TrustStatus,
} from '@qalam/shared';
import { screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/test/render';

import { collaborationApi } from '../api/collaboration.api';
import { trustApi } from '../api/trust.api';
import type { StoryCapability, TrustSummary } from '../types/collaboration.types';
import { RestrictedWall } from './restricted-wall';

vi.mock('../api/collaboration.api');
vi.mock('../api/trust.api');

const capabilities = vi.mocked(collaborationApi.capabilities);
const trust = vi.mocked(trustApi.me);

const STORY = 'story-1';
const ACTION = POLICY_ACTIONS.PublicationPublish;

function decision(over: Partial<StoryCapability> = {}): StoryCapability {
  return {
    action: ACTION,
    effect: PolicyEffect.Allow,
    allowed: true,
    reason: 'OWNERSHIP',
    obligations: [],
    ...over,
  };
}

function summary(over: Partial<TrustSummary> = {}): TrustSummary {
  return {
    score: 20,
    level: TrustLevel.Basic,
    status: TrustStatus.ReadOnly,
    activeStrikeWeight: 3,
    restrictions: [],
    ...over,
  };
}

function wall(): void {
  renderWithProviders(
    <RestrictedWall storyId={STORY} action={ACTION}>
      <p>the workflow</p>
    </RestrictedWall>,
  );
}

/**
 * The restricted-state wall (AF6 W3c — docs/49 §3, §5).
 *
 * The behaviour under test is the distinction the whole component exists for: a plain `deny` means
 * "not your story" (handled by `CapabilityGate` rendering nothing), while a **restrictive effect**
 * means "your account is limited" — a different sentence, which deserves an explanation rather than
 * an empty page.
 *
 * And it must fail OPEN. Telling someone in good standing that they are restricted is worse than
 * briefly not telling someone who is; the server refuses the write either way.
 */
describe('RestrictedWall', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    trust.mockResolvedValue(summary());
  });

  it('renders the children when the action is allowed', async () => {
    capabilities.mockResolvedValue({ storyId: STORY, capabilities: [decision()] });
    wall();
    expect(await screen.findByText('the workflow')).toBeInTheDocument();
  });

  it('renders the children on a PLAIN deny — that is "not yours", not "you are limited"', async () => {
    capabilities.mockResolvedValue({
      storyId: STORY,
      capabilities: [decision({ effect: PolicyEffect.Deny, allowed: false, reason: 'ROLE_RANK' })],
    });
    wall();

    expect(await screen.findByText('the workflow')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /your account/i })).not.toBeInTheDocument();
    // No standing is fetched for an ordinary denial.
    expect(trust).not.toHaveBeenCalled();
  });

  it('fails open when the map does not mention the action at all', async () => {
    capabilities.mockResolvedValue({ storyId: STORY, capabilities: [] });
    wall();
    expect(await screen.findByText('the workflow')).toBeInTheDocument();
  });

  it('fails open when the capability map cannot be loaded', async () => {
    capabilities.mockRejectedValue(new Error('boom'));
    wall();
    expect(await screen.findByText('the workflow')).toBeInTheDocument();
  });

  it.each([
    [PolicyEffect.ReadOnly, /read-only/i],
    [PolicyEffect.Suspended, /suspended/i],
    [PolicyEffect.Muted, /muted/i],
  ])('walls on a %s effect and names the standing', async (effect, headline) => {
    capabilities.mockResolvedValue({
      storyId: STORY,
      capabilities: [decision({ effect, allowed: false, reason: 'TRUST_RESTRICTED' })],
    });
    trust.mockResolvedValue(
      summary({
        status:
          effect === PolicyEffect.ReadOnly
            ? TrustStatus.ReadOnly
            : effect === PolicyEffect.Suspended
              ? TrustStatus.Suspended
              : TrustStatus.Muted,
      }),
    );
    wall();

    expect(await screen.findByRole('heading', { name: headline })).toBeInTheDocument();
    expect(screen.queryByText('the workflow')).not.toBeInTheDocument();
  });

  it('lists the restrictions in force, with scope — and never a lifted one', async () => {
    capabilities.mockResolvedValue({
      storyId: STORY,
      capabilities: [
        decision({ effect: PolicyEffect.ReadOnly, allowed: false, reason: 'TRUST_RESTRICTED' }),
      ],
    });
    trust.mockResolvedValue(
      summary({
        restrictions: [
          {
            id: 'r-1',
            userId: 'u-1',
            type: RestrictionType.ReadOnly,
            scope: RestrictionScope.Publishing,
            reason: 'Repeated policy violations',
            issuedById: 'admin-1',
            expiresAt: null,
            liftedAt: null,
            createdAt: new Date('2026-07-01T00:00:00Z').toISOString(),
          },
          {
            id: 'r-2',
            userId: 'u-1',
            type: RestrictionType.Muted,
            scope: RestrictionScope.Comments,
            reason: 'Already served',
            issuedById: 'admin-1',
            expiresAt: null,
            // `liftedAt` is how the wire says "no longer applies" — there is no `active` flag (T-2).
            liftedAt: new Date('2026-07-10T00:00:00Z').toISOString(),
            createdAt: new Date('2026-06-01T00:00:00Z').toISOString(),
          },
        ],
      }),
    );
    wall();

    expect(await screen.findByText('Repeated policy violations')).toBeInTheDocument();
    expect(screen.getByText(/Publishing/)).toBeInTheDocument();
    expect(screen.getByText(/No end date/)).toBeInTheDocument();
    expect(screen.queryByText('Already served')).not.toBeInTheDocument();
  });

  it('still walls when the trust read fails, falling back to the server’s reason', async () => {
    capabilities.mockResolvedValue({
      storyId: STORY,
      capabilities: [
        decision({ effect: PolicyEffect.Suspended, allowed: false, reason: 'TRUST_SUSPENDED' }),
      ],
    });
    trust.mockRejectedValue(new Error('boom'));
    wall();

    // The wall stands on the capability decision alone — the standing read only enriches it.
    expect(
      await screen.findByRole('heading', { name: /your account is limited/i }),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('TRUST_SUSPENDED')).toBeInTheDocument();
    });
  });
});
