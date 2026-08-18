import {
  RestrictionScope,
  RestrictionType,
  Role,
  StrikeSeverity,
  TrustLevel,
  TrustStatus,
  UserStatus,
} from '@qalam/shared';
import { screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuthStore } from '@/stores/auth.store';
import { renderWithProviders } from '@/test/render';

import type { AdminRestriction, AdminStrike, AdminTrustSummary } from '../types/trust.types';
import { TrustPanel } from './trust-panel';
import { TrustRestrictionList } from './trust-restriction-list';
import { TrustStandingCard } from './trust-standing-card';
import { TrustStrikeList } from './trust-strike-list';

vi.mock('../api/trust.api');

const { trustApi } = await import('../api/trust.api');
const summaryRead = vi.mocked(trustApi.summary);
const restrictionsRead = vi.mocked(trustApi.restrictions);
const strikesRead = vi.mocked(trustApi.strikes);

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

function strike(over: Partial<AdminStrike> = {}): AdminStrike {
  return {
    id: 's1',
    userId: USER_ID,
    severity: StrikeSeverity.Moderate,
    reason: 'Harassment in comments',
    weight: 2,
    reportId: null,
    issuedById: 'mod1',
    expiresAt: null,
    revokedAt: null,
    createdAt: '2026-08-01T00:00:00.000Z',
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  // The third read B9 added (A2-2). Every TrustPanel test needs an answer for it; individual
  // tests override with the history they are about.
  strikesRead.mockResolvedValue([]);
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
    strikesRead.mockResolvedValue([]);

    renderWithProviders(<TrustPanel userId={USER_ID} />);

    expect(screen.getByText('Trust sanctions are not account suspension.')).toBeInTheDocument();
    expect(screen.getByText(/still lets the person sign in and read/)).toBeInTheDocument();
    // UPDATED, not dropped (B9, A2-1): A2's assertion here pinned "blocks sign-in and revokes every
    // session, and the Policy Engine never sees it". The last clause was true and was the defect —
    // a closed account read as being in good standing for every decision. The engine reads
    // `users.status` now, so the note has to say so.
    expect(
      screen.getByText(/the Policy Engine refuses anything a live token could still reach/),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Policy Engine never sees it/)).not.toBeInTheDocument();
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
    expect(strikesRead).not.toHaveBeenCalled();
  });

  it('fires the THIRD read too, and shows the strikes behind the weight (B9, A2-2)', async () => {
    summaryRead.mockResolvedValue(summary({ activeStrikeWeight: 2 }));
    restrictionsRead.mockResolvedValue([]);
    strikesRead.mockResolvedValue([strike()]);

    renderWithProviders(<TrustPanel userId={USER_ID} />);

    await waitFor(() => expect(strikesRead).toHaveBeenCalledWith(USER_ID, expect.anything()));
    // The weight on the standing card now has visible provenance: the row that produced it. The
    // severity label is asserted through the ROW, because the strike form's severity select offers
    // the same string as an option and matching either would prove nothing about the list.
    const row = (await screen.findByText('Counting')).closest('li');
    expect(row).not.toBeNull();
    expect(within(row as HTMLElement).getByText(/Moderate — weight 2/)).toBeInTheDocument();
    expect(within(row as HTMLElement).getByText(/Never expires · issued/)).toBeInTheDocument();
  });

  it('says which figure is which when the list and the standing disagree', async () => {
    // A strike that expired between the two reads. Neither number is wrong, so the screen names
    // the source of each rather than picking one and leaving an operator to disbelieve both.
    summaryRead.mockResolvedValue(summary({ activeStrikeWeight: 4 }));
    restrictionsRead.mockResolvedValue([]);
    strikesRead.mockResolvedValue([strike({ weight: 2 })]);

    renderWithProviders(<TrustPanel userId={USER_ID} />);

    expect(
      await screen.findByText(/strikes listed below account for a weight of 2/),
    ).toBeInTheDocument();
  });

  it('stays quiet when the two figures agree', async () => {
    summaryRead.mockResolvedValue(summary({ activeStrikeWeight: 2 }));
    restrictionsRead.mockResolvedValue([]);
    strikesRead.mockResolvedValue([strike({ weight: 2 })]);

    renderWithProviders(<TrustPanel userId={USER_ID} />);

    await waitFor(() => expect(strikesRead).toHaveBeenCalled());
    expect(screen.queryByText(/account for a weight of/)).not.toBeInTheDocument();
  });
});

describe('the two suspensions are told apart on the screen (B9, A2-1)', () => {
  it('refuses to render a suspended ACCOUNT as being in good standing', () => {
    // The display defect in one assertion. A suspension writes no trust restriction, so the trust
    // standing of a closed account is whatever it was — commonly "Good standing", in success green,
    // on the same screen as the suspend control.
    renderWithProviders(
      <TrustStandingCard
        summary={summary({ status: TrustStatus.Normal, accountStatus: UserStatus.Suspended })}
      />,
    );

    // Both are stated, and each is named for which system it belongs to.
    expect(screen.getByText('Good standing')).toBeInTheDocument();
    expect(screen.getByText('Trust standing')).toBeInTheDocument();
    expect(screen.getByText('Suspended')).toBeInTheDocument();
    expect(screen.getByText(/The ACCOUNT is suspended/)).toBeInTheDocument();
    expect(
      screen.getByText(/lift it from the account actions, not from this tab/i),
    ).toBeInTheDocument();
  });

  it('says nothing about the account when it is active — a badge that always shows is not read', () => {
    renderWithProviders(
      <TrustStandingCard summary={summary({ accountStatus: UserStatus.Active })} />,
    );

    expect(screen.getByText('Good standing')).toBeInTheDocument();
    expect(screen.queryByText(/The ACCOUNT is suspended/)).not.toBeInTheDocument();
  });

  it('distinguishes a DEACTIVATED account, which implies no sanction at all', () => {
    renderWithProviders(
      <TrustStandingCard summary={summary({ accountStatus: UserStatus.Deactivated })} />,
    );

    expect(screen.getByText('Deactivated')).toBeInTheDocument();
    expect(screen.getByText(/no trust sanction is implied by it/)).toBeInTheDocument();
  });

  it('renders unchanged for the SELF-read shape, which carries no account status', () => {
    // `accountStatus` is absent on `me/trust`, so its absence must not look like a state.
    renderWithProviders(<TrustStandingCard summary={summary()} />);

    expect(screen.getByText('Good standing')).toBeInTheDocument();
    expect(screen.queryByText('Account')).not.toBeInTheDocument();
  });
});

describe('TrustStrikeList — active and historical, and only one of them counts', () => {
  it('marks a revoked strike as history rather than a live one', () => {
    renderWithProviders(
      <TrustStrikeList
        strikes={[
          strike({ id: 's1' }),
          strike({ id: 's2', revokedAt: '2026-08-10T00:00:00.000Z' }),
        ]}
      />,
    );

    expect(screen.getByText('Counting')).toBeInTheDocument();
    expect(screen.getByText('Revoked')).toBeInTheDocument();
  });

  it('marks an expired strike as history without needing a revocation', () => {
    renderWithProviders(
      <TrustStrikeList strikes={[strike({ expiresAt: '2026-01-01T00:00:00.000Z' })]} />,
    );

    expect(screen.getByText('Expired')).toBeInTheDocument();
    expect(screen.queryByText('Counting')).not.toBeInTheDocument();
  });

  it('offers the action only on a row that still counts', () => {
    renderWithProviders(
      <TrustStrikeList
        strikes={[
          strike({ id: 's1' }),
          strike({ id: 's2', revokedAt: '2026-08-10T00:00:00.000Z' }),
        ]}
        renderActions={() => <button type="button">Revoke</button>}
      />,
    );

    // One button for two rows: the server 409s a second revoke, so offering it would be a lie.
    expect(screen.getAllByRole('button', { name: 'Revoke' })).toHaveLength(1);
  });

  it('calls a clean record a clean record, not an error', () => {
    renderWithProviders(<TrustStrikeList strikes={[]} />);

    expect(screen.getByText('No strikes on record')).toBeInTheDocument();
    expect(screen.getByText(/active strike weight is 0/)).toBeInTheDocument();
  });
});
