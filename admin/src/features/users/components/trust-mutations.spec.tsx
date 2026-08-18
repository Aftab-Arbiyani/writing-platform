import {
  RestrictionScope,
  RestrictionType,
  Role,
  StrikeSeverity,
  TrustLevel,
  TrustStatus,
} from '@qalam/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { usePermissions } from '@/hooks/use-permissions';
import { useAuthStore } from '@/stores/auth.store';
import { renderWithProviders } from '@/test/render';

import type { AdminRestriction, AdminStrike, AdminTrustSummary } from '../types/trust.types';
import { TrustLiftButton } from './trust-lift-button';
import { TrustPanel } from './trust-panel';
import { TrustRestrictForm } from './trust-restrict-form';
import { TrustRevokeStrikeButton } from './trust-revoke-strike-button';
import { TrustStrikeForm } from './trust-strike-form';

vi.mock('../api/trust.api');
/**
 * `usePermissions` is mocked rather than driven through the auth store, because the grant split this
 * panel implements does not exist in any seeded role: `Role.Moderator` upward all hold `trust.*`, and
 * `usePermissions` derives from the static `DEFAULT_ROLE_PERMISSIONS` map. `role_permissions` IS
 * editable at runtime, so a `trust.view`-only operator is reachable in production and unreachable in
 * a test unless the grant set is synthesised.
 */
vi.mock('@/hooks/use-permissions');

const { trustApi } = await import('../api/trust.api');
const issueStrike = vi.mocked(trustApi.issueStrike);
const applyRestriction = vi.mocked(trustApi.applyRestriction);
const liftRestriction = vi.mocked(trustApi.liftRestriction);
const revokeStrike = vi.mocked(trustApi.revokeStrike);

const USER_ID = '55555555-5555-4555-8555-555555555555';
const RESTRICTION_ID = '66666666-6666-4666-8666-666666666666';
const STRIKE_ID = '77777777-7777-4777-8777-777777777777';

function summary(over: Partial<AdminTrustSummary> = {}): AdminTrustSummary {
  return {
    score: 50,
    level: TrustLevel.Member,
    status: TrustStatus.Normal,
    activeStrikeWeight: 0,
    restrictions: [],
    ...over,
  };
}

function restriction(over: Partial<AdminRestriction> = {}): AdminRestriction {
  return {
    id: RESTRICTION_ID,
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
    id: STRIKE_ID,
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

/** The dialog's own confirm button, not the form button that opened it. */
function dialogButton(name: RegExp | string): HTMLElement {
  return within(screen.getByRole('dialog')).getByRole('button', { name });
}

function typeReason(label: RegExp, text: string): void {
  fireEvent.change(screen.getByLabelText(label), { target: { value: text } });
}

/** A synthetic grant set — `can` answers from exactly these codes. */
function grants(...codes: string[]): ReturnType<typeof usePermissions> {
  return {
    role: Role.Moderator,
    hasRole: () => true,
    can: (permission) => codes.includes(permission),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(usePermissions).mockReturnValue(grants('trust.view', 'trust.manage'));
  useAuthStore.setState({ status: 'authenticated', role: Role.Moderator });
  issueStrike.mockResolvedValue({
    id: 's1',
    userId: USER_ID,
    severity: StrikeSeverity.Minor,
    reason: 'r',
    weight: 1,
    reportId: null,
    issuedById: 'mod1',
    expiresAt: null,
    revokedAt: null,
    createdAt: '2026-08-17T00:00:00.000Z',
  });
  applyRestriction.mockResolvedValue(restriction());
  liftRestriction.mockResolvedValue(restriction({ liftedAt: '2026-08-17T00:00:00.000Z' }));
  revokeStrike.mockResolvedValue(strike({ revokedAt: '2026-08-18T00:00:00.000Z' }));
  vi.mocked(trustApi.summary).mockResolvedValue(summary());
  vi.mocked(trustApi.restrictions).mockResolvedValue([]);
  vi.mocked(trustApi.strikes).mockResolvedValue([]);
});
afterEach(() => useAuthStore.getState().clear());

describe('TrustStrikeForm — the escalation is stated before it happens', () => {
  it('confirms before issuing, and never posts on the first click', () => {
    renderWithProviders(
      <TrustStrikeForm userId={USER_ID} activeStrikeWeight={0} activeRestrictions={[]} />,
    );
    typeReason(/Reason/, 'Repeated spam');
    fireEvent.click(screen.getByRole('button', { name: 'Issue strike' }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(issueStrike).not.toHaveBeenCalled();
  });

  it('states this strike’s weight and the resulting total, below any threshold', () => {
    renderWithProviders(
      <TrustStrikeForm userId={USER_ID} activeStrikeWeight={0} activeRestrictions={[]} />,
    );
    typeReason(/Reason/, 'Repeated spam');
    fireEvent.click(screen.getByRole('button', { name: 'Issue strike' }));

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('This strike carries weight 1.');
    // Was "becomes 1 (projected from 0)" until B9. The hedge was A2-2's doing: no route listed
    // strikes, so the client could not check the standing's weight against the rows the server sums.
    // `GET users/:id/strikes` closes that, the panel compares the two, and the figure is stated.
    expect(dialog).toHaveTextContent('becomes 1, from 0');
    expect(dialog).not.toHaveTextContent('projected from');
    // Both thresholds are named even when neither is crossed.
    expect(dialog).toHaveTextContent(
      'A restriction follows automatically at 3 and a suspension at 6.',
    );
  });

  it('at the restriction boundary, says the server will ALSO restrict the account', () => {
    // Weight 2 + a moderate strike (2) = 3, exactly STRIKE_RESTRICTION_THRESHOLD.
    renderWithProviders(
      <TrustStrikeForm userId={USER_ID} activeStrikeWeight={2} activeRestrictions={[]} />,
    );
    fireEvent.change(screen.getByLabelText('Severity'), {
      target: { value: StrikeSeverity.Minor },
    });
    typeReason(/Reason/, 'Third offence');
    fireEvent.click(screen.getByRole('button', { name: 'Issue strike' }));

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('This strike will also restrict the account');
    expect(dialog).toHaveTextContent('3 reaches the restriction threshold of 3');
    expect(dialog).toHaveTextContent('permanent global "Restricted" restriction');
    expect(dialog).toHaveTextContent('Suspension follows automatically at 6 — 3 more weight');
  });

  it('at the suspension boundary, the title itself says the account will be suspended', () => {
    // Weight 5 + a minor strike (1) = 6, exactly STRIKE_SUSPENSION_THRESHOLD.
    renderWithProviders(
      <TrustStrikeForm userId={USER_ID} activeStrikeWeight={5} activeRestrictions={[]} />,
    );
    typeReason(/Reason/, 'Sixth offence');
    fireEvent.click(screen.getByRole('button', { name: 'Issue strike' }));

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('This strike will also suspend the account');
    expect(dialog).toHaveTextContent('6 reaches the suspension threshold of 6');
    expect(dialog).toHaveTextContent('permanent global "Suspended" restriction');
  });

  it('does not promise a second suspension when one is already in force', () => {
    renderWithProviders(
      <TrustStrikeForm
        userId={USER_ID}
        activeStrikeWeight={6}
        activeRestrictions={[
          restriction({ type: RestrictionType.Suspended, scope: RestrictionScope.Global }),
        ]}
      />,
    );
    typeReason(/Reason/, 'Another offence');
    fireEvent.click(screen.getByRole('button', { name: 'Issue strike' }));

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('a global suspension is already in force');
    expect(dialog).not.toHaveTextContent('will ALSO apply');
  });

  it('points at the revoke rather than claiming a strike cannot be undone (B9, A2-2)', () => {
    // A2's version of this test asserted "A strike cannot be revoked or edited once issued", which
    // was accurate then — `revokeStrike` had no caller. It is now wired, so the assertion is
    // UPDATED rather than dropped: the dialog must name the remedy and must no longer deny one.
    renderWithProviders(
      <TrustStrikeForm userId={USER_ID} activeStrikeWeight={0} activeRestrictions={[]} />,
    );
    typeReason(/Reason/, 'Spam');
    fireEvent.click(screen.getByRole('button', { name: 'Issue strike' }));

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('cannot be edited afterwards, but it can be revoked');
    expect(dialog).toHaveTextContent('the only thing that lowers the weight again');
    expect(dialog).not.toHaveTextContent('cannot be revoked');
  });

  it('posts severity + reason once confirmed, and omits the empty optional fields', async () => {
    renderWithProviders(
      <TrustStrikeForm userId={USER_ID} activeStrikeWeight={0} activeRestrictions={[]} />,
    );
    fireEvent.change(screen.getByLabelText('Severity'), {
      target: { value: StrikeSeverity.Severe },
    });
    typeReason(/Reason/, 'Threats');
    fireEvent.click(screen.getByRole('button', { name: 'Issue strike' }));
    fireEvent.click(dialogButton('Issue strike'));

    await waitFor(() =>
      expect(issueStrike).toHaveBeenCalledWith(USER_ID, {
        severity: StrikeSeverity.Severe,
        reason: 'Threats',
      }),
    );
  });

  it('cannot be submitted without a reason — the server requires one', () => {
    renderWithProviders(
      <TrustStrikeForm userId={USER_ID} activeStrikeWeight={0} activeRestrictions={[]} />,
    );
    expect(screen.getByRole('button', { name: 'Issue strike' })).toBeDisabled();
  });
});

describe('TrustRestrictForm — permanent and temporary cannot be confused', () => {
  it('warns that an empty end date means permanent, before the dialog opens', () => {
    renderWithProviders(<TrustRestrictForm userId={USER_ID} />);
    expect(screen.getByText(/Empty means PERMANENT/)).toBeInTheDocument();
  });

  it('says PERMANENT in the title and that nothing will expire it', () => {
    renderWithProviders(<TrustRestrictForm userId={USER_ID} />);
    typeReason(/Reason/, 'Harassment');
    fireEvent.click(screen.getByRole('button', { name: 'Apply restriction' }));

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('Apply a PERMANENT muted restriction?');
    expect(dialog).toHaveTextContent('It has NO end date');
    expect(dialogButton('Apply permanently')).toBeInTheDocument();
  });

  it('names the end date in the title when one is set', () => {
    renderWithProviders(<TrustRestrictForm userId={USER_ID} />);
    fireEvent.change(screen.getByLabelText(/Ends on/), { target: { value: '2026-08-24' } });
    typeReason(/Reason/, 'Cooling-off period');
    fireEvent.click(screen.getByRole('button', { name: 'Apply restriction' }));

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent(/Apply a muted restriction until/);
    expect(dialog).toHaveTextContent(/It ends by itself on/);
    expect(dialog).not.toHaveTextContent('NO end date');
  });

  it('distinguishes a trust suspension from the account suspension, in the dialog', () => {
    renderWithProviders(<TrustRestrictForm userId={USER_ID} />);
    fireEvent.change(screen.getByLabelText('Restriction'), {
      target: { value: RestrictionType.Suspended },
    });
    typeReason(/Reason/, 'Serious breach');
    fireEvent.click(screen.getByRole('button', { name: 'Apply restriction' }));

    expect(screen.getByRole('dialog')).toHaveTextContent(
      'This is the trust suspension, not the account suspension: they can still sign in and read.',
    );
  });

  it('offers exactly the enum values the server accepts', () => {
    renderWithProviders(<TrustRestrictForm userId={USER_ID} />);

    const types = [...screen.getByLabelText('Restriction').querySelectorAll('option')].map((o) =>
      o.getAttribute('value'),
    );
    const scopes = [...screen.getByLabelText('Applies to').querySelectorAll('option')].map((o) =>
      o.getAttribute('value'),
    );
    expect(new Set(types)).toEqual(new Set<string>(Object.values(RestrictionType)));
    expect(new Set(scopes)).toEqual(new Set<string>(Object.values(RestrictionScope)));
  });

  it('posts type, scope and reason, omitting expiresAt when permanent', async () => {
    renderWithProviders(<TrustRestrictForm userId={USER_ID} />);
    fireEvent.change(screen.getByLabelText('Restriction'), {
      target: { value: RestrictionType.ReadOnly },
    });
    fireEvent.change(screen.getByLabelText('Applies to'), {
      target: { value: RestrictionScope.Publishing },
    });
    typeReason(/Reason/, 'Plagiarism review');
    fireEvent.click(screen.getByRole('button', { name: 'Apply restriction' }));
    fireEvent.click(dialogButton('Apply permanently'));

    await waitFor(() =>
      expect(applyRestriction).toHaveBeenCalledWith(USER_ID, {
        type: RestrictionType.ReadOnly,
        scope: RestrictionScope.Publishing,
        reason: 'Plagiarism review',
      }),
    );
  });
});

describe('TrustLiftButton — keyed by the restriction, not the user', () => {
  it('confirms first, and says the strike weight does not move', () => {
    renderWithProviders(<TrustLiftButton restriction={restriction()} />);
    fireEvent.click(screen.getByRole('button', { name: /Lift/ }));

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('Lift the muted restriction?');
    expect(dialog).toHaveTextContent('Their active strike weight is unchanged');
    expect(liftRestriction).not.toHaveBeenCalled();
  });

  it('sends the RESTRICTION id — the asymmetry in this route', async () => {
    renderWithProviders(<TrustLiftButton restriction={restriction()} />);
    fireEvent.click(screen.getByRole('button', { name: /Lift/ }));
    fireEvent.click(dialogButton('Lift restriction'));

    await waitFor(() => expect(liftRestriction).toHaveBeenCalledWith(RESTRICTION_ID));
    // The user id would be accepted by the type system and 404 at runtime.
    expect(liftRestriction).not.toHaveBeenCalledWith(USER_ID);
  });
});

describe('TrustRevokeStrikeButton — the only thing that lowers the weight (B9, A2-2)', () => {
  it('confirms before revoking, and states where the weight lands', () => {
    renderWithProviders(
      <TrustRevokeStrikeButton
        strike={strike({ weight: 2 })}
        activeStrikeWeight={5}
        restrictionInForce={false}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Revoke/ }));

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('Revoke this strike?');
    expect(dialog).toHaveTextContent('goes from 5 to 3');
    expect(dialog).toHaveTextContent('the only action that lowers the weight');
    expect(revokeStrike).not.toHaveBeenCalled();
  });

  it('warns that a restriction in force is NOT lifted by this', () => {
    // The surprise this copy exists to prevent: an operator revoking strikes to get a user out of a
    // suspension, and the suspension staying. Dropping below the threshold does not undo a sanction.
    renderWithProviders(
      <TrustRevokeStrikeButton
        strike={strike()}
        activeStrikeWeight={6}
        restrictionInForce={true}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Revoke/ }));

    expect(screen.getByRole('dialog')).toHaveTextContent('does not lift it');
    expect(screen.getByRole('dialog')).toHaveTextContent('Lift it from the restriction list');
  });

  it('says nothing about restrictions when none is in force', () => {
    renderWithProviders(
      <TrustRevokeStrikeButton
        strike={strike()}
        activeStrikeWeight={2}
        restrictionInForce={false}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Revoke/ }));

    expect(screen.getByRole('dialog')).not.toHaveTextContent('does not lift it');
  });

  it('sends the STRIKE id, not the user id — the same asymmetry as the lift', async () => {
    renderWithProviders(
      <TrustRevokeStrikeButton
        strike={strike()}
        activeStrikeWeight={2}
        restrictionInForce={false}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Revoke/ }));
    fireEvent.click(dialogButton('Revoke strike'));

    await waitFor(() => expect(revokeStrike).toHaveBeenCalledWith(STRIKE_ID));
    // Either other id would compile and 404 at runtime.
    expect(revokeStrike).not.toHaveBeenCalledWith(USER_ID);
    expect(revokeStrike).not.toHaveBeenCalledWith(RESTRICTION_ID);
  });
});

describe('TrustPanel — `trust.manage` gates every affordance', () => {
  it('offers both forms, a lift and a revoke to an operator who holds `trust.manage`', async () => {
    vi.mocked(trustApi.restrictions).mockResolvedValue([restriction()]);
    vi.mocked(trustApi.strikes).mockResolvedValue([strike()]);

    renderWithProviders(<TrustPanel userId={USER_ID} />);

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Issue strike' })).toBeInTheDocument(),
    );
    expect(screen.getByRole('button', { name: 'Apply restriction' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Lift/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Revoke/ })).toBeInTheDocument();
  });

  it('gives a `trust.view`-only operator the whole panel and NO affordances', async () => {
    vi.mocked(usePermissions).mockReturnValue(grants('trust.view'));
    vi.mocked(trustApi.restrictions).mockResolvedValue([restriction()]);
    vi.mocked(trustApi.strikes).mockResolvedValue([strike()]);

    renderWithProviders(<TrustPanel userId={USER_ID} />);

    // The reads still render in full — the restriction row, the strike row and the standing.
    await waitFor(() => expect(screen.getByText('In force')).toBeInTheDocument());
    expect(screen.getByText('Counting')).toBeInTheDocument();
    expect(screen.getAllByText(/Standing/).length).toBeGreaterThan(0);
    expect(screen.getByText('Good standing')).toBeInTheDocument();

    // And not one write affordance exists, disabled or otherwise. The revoke is the one B9 added,
    // and it is gated `trust.manage` server-side — a `trust.view`-only caller gets a 403 there, so
    // offering the button would be an affordance that cannot work.
    expect(screen.queryByRole('button', { name: 'Issue strike' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Apply restriction' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Lift/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Revoke/ })).not.toBeInTheDocument();
  });
});
