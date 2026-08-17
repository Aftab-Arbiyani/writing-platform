import { RestrictionScope, RestrictionType, Role, TrustLevel, TrustStatus } from '@qalam/shared';
import { screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuthStore } from '@/stores/auth.store';
import { renderWithProviders } from '@/test/render';

import type { AdminRestriction, AdminTrustSummary } from '../types/trust.types';
import { TrustPanel } from './trust-panel';
import { TrustRestrictionList } from './trust-restriction-list';
import { TrustStandingCard } from './trust-standing-card';

vi.mock('../api/trust.api');

const { trustApi } = await import('../api/trust.api');
const summaryRead = vi.mocked(trustApi.summary);
const restrictionsRead = vi.mocked(trustApi.restrictions);

const USER_ID = '33333333-3333-4333-8333-333333333333';

function summary(over: Partial<AdminTrustSummary> = {}): AdminTrustSummary {
  return {
    score: 62,
    level: TrustLevel.Member,
    status: TrustStatus.Normal,
    activeStrikeWeight: 0,
    restrictions: [],
    ...over,
  };
}

function restriction(over: Partial<AdminRestriction> = {}): AdminRestriction {
  return {
    id: 'r1',
    userId: USER_ID,
    type: RestrictionType.Muted,
    scope: RestrictionScope.Comments,
    reason: 'Harassment in comments',
    issuedById: 'mod1',
    expiresAt: null,
    liftedAt: null,
    createdAt: '2026-08-01T00:00:00.000Z',
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({ status: 'authenticated', role: Role.Moderator });
});
afterEach(() => useAuthStore.getState().clear());

describe('TrustStandingCard — the score is never a bare number', () => {
  it('renders the score against its scale and names the current band', () => {
    renderWithProviders(<TrustStandingCard summary={summary({ score: 62 })} />);

    expect(screen.getByText('62')).toBeInTheDocument();
    expect(screen.getByText(/of 100 · Member \(50–79\)/)).toBeInTheDocument();
    // All four boundaries are on screen, so "62" can be placed without prior knowledge.
    expect(screen.getByText(/Member 50–79 — current/)).toBeInTheDocument();
    expect(screen.getByText('Trusted 80–100')).toBeInTheDocument();
    expect(screen.getByText('Basic 25–49')).toBeInTheDocument();
    expect(screen.getByText('New 0–24')).toBeInTheDocument();
  });

  it('names both escalation thresholds beside the active strike weight', () => {
    renderWithProviders(<TrustStandingCard summary={summary({ activeStrikeWeight: 2 })} />);

    expect(screen.getByText('Active strike weight')).toBeInTheDocument();
    expect(screen.getByText(/Restriction at 3, suspension at 6/)).toBeInTheDocument();
  });

  it('uses the standing word the customer clients use, not the raw enum', () => {
    renderWithProviders(<TrustStandingCard summary={summary({ status: TrustStatus.Normal })} />);
    expect(screen.getByText('Good standing')).toBeInTheDocument();
  });

  it('shows a stored tier that disagrees with the score rather than correcting it', () => {
    // A stale `trust_profiles.level` is the server's value and what the platform reads.
    renderWithProviders(
      <TrustStandingCard summary={summary({ score: 10, level: TrustLevel.Trusted })} />,
    );
    expect(screen.getByText(/does not match the band this score falls in/)).toBeInTheDocument();
  });
});

describe('TrustRestrictionList — history must not read as a live sanction', () => {
  it('renders a clean record as a calm empty state, not an error', () => {
    renderWithProviders(<TrustRestrictionList restrictions={[]} />);

    expect(screen.getByText('No restrictions on record')).toBeInTheDocument();
    expect(screen.getByText(/Nothing is wrong/)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('marks an active restriction "In force" and says what it stops', () => {
    renderWithProviders(<TrustRestrictionList restrictions={[restriction()]} />);

    expect(screen.getByText('In force')).toBeInTheDocument();
    expect(screen.getByText(/Muted/)).toBeInTheDocument();
    expect(screen.getByText(/Comments/)).toBeInTheDocument();
    expect(
      screen.getByText('Cannot comment or suggest. Other writes are unaffected.'),
    ).toBeInTheDocument();
    expect(screen.getByText(/No end date/)).toBeInTheDocument();
  });

  it('marks a lifted restriction as history and dates the lift', () => {
    renderWithProviders(
      <TrustRestrictionList
        restrictions={[restriction({ liftedAt: '2026-08-10T09:00:00.000Z' })]}
      />,
    );

    expect(screen.getByText('Lifted')).toBeInTheDocument();
    expect(screen.getByText(/^Lifted /)).toBeInTheDocument();
    expect(screen.queryByText('In force')).not.toBeInTheDocument();
  });

  it('marks a past expiry as expired, not as live', () => {
    renderWithProviders(
      <TrustRestrictionList
        restrictions={[restriction({ expiresAt: '2026-01-01T00:00:00.000Z' })]}
      />,
    );

    expect(screen.getByText('Expired')).toBeInTheDocument();
    expect(screen.queryByText('In force')).not.toBeInTheDocument();
  });
});

describe('TrustPanel — two reads, and the sanction the panel is NOT', () => {
  it('explains how a trust suspension differs from the account suspension on the same screen', async () => {
    summaryRead.mockResolvedValue(summary());
    restrictionsRead.mockResolvedValue([]);

    renderWithProviders(<TrustPanel userId={USER_ID} />);

    expect(screen.getByText('Trust sanctions are not account suspension.')).toBeInTheDocument();
    expect(screen.getByText(/blocks sign-in and revokes every session/)).toBeInTheDocument();
    expect(screen.getByText(/still lets the person sign in and read/)).toBeInTheDocument();
    await waitFor(() => expect(summaryRead).toHaveBeenCalledWith(USER_ID, expect.anything()));
  });

  it('fires BOTH reads — the standing and the history are different sets', async () => {
    summaryRead.mockResolvedValue(summary({ restrictions: [restriction()] }));
    restrictionsRead.mockResolvedValue([
      restriction(),
      restriction({ id: 'r2', liftedAt: '2026-07-01T00:00:00.000Z' }),
    ]);

    renderWithProviders(<TrustPanel userId={USER_ID} />);

    await waitFor(() => {
      expect(summaryRead).toHaveBeenCalledTimes(1);
      expect(restrictionsRead).toHaveBeenCalledTimes(1);
    });
    // The standing counts only the active row; the list shows the lifted one as history.
    await waitFor(() => expect(screen.getByText('Lifted')).toBeInTheDocument());
    expect(screen.getByText('In force')).toBeInTheDocument();
  });

  it('fires nothing while the tab is not selected', () => {
    summaryRead.mockResolvedValue(summary());
    restrictionsRead.mockResolvedValue([]);

    renderWithProviders(<TrustPanel userId={USER_ID} active={false} />);

    expect(summaryRead).not.toHaveBeenCalled();
    expect(restrictionsRead).not.toHaveBeenCalled();
  });
});
