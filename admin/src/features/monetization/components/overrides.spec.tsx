import { ENTITLEMENT_CACHE_TTL_SECONDS, OverrideEffect, PremiumFeature } from '@qalam/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/test/render';

import { EntitlementCacheNote } from './entitlement-cache-note';
import { OverrideGrantForm } from './override-grant-form';
import { OverrideTable } from './override-table';
import type { AdminEntitlementOverride } from '../types/monetization.types';

vi.mock('../api/monetization.api');

const { monetizationApi } = await import('../api/monetization.api');
const grant = vi.mocked(monetizationApi.grantOverride);
const revoke = vi.mocked(monetizationApi.revokeOverride);

const OVERRIDE_ID = '11111111-1111-4111-8111-111111111111';

function override(over: Partial<AdminEntitlementOverride> = {}): AdminEntitlementOverride {
  return {
    id: OVERRIDE_ID,
    userId: '22222222-2222-4222-8222-222222222222',
    feature: PremiumFeature.AiWriting,
    effect: OverrideEffect.Allow,
    active: true,
    expiresAt: null,
    reason: 'Support goodwill',
    createdAt: '2026-08-17T10:00:00.000Z',
    ...over,
  };
}

/** The confirm button inside the dialog, not the row button that opened it. */
function dialogButton(name: string): HTMLElement {
  return within(screen.getByRole('dialog')).getByRole('button', { name });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('EntitlementCacheNote — the lag is stated, not discovered', () => {
  it('names the TTL from the shared constant so the copy cannot drift', () => {
    renderWithProviders(<EntitlementCacheNote />);

    expect(
      screen.getByText(new RegExp(`about ${String(ENTITLEMENT_CACHE_TTL_SECONDS)} seconds`)),
    ).toBeInTheDocument();
  });

  it('tells the operator not to re-grant — the failure mode this note prevents', () => {
    renderWithProviders(<EntitlementCacheNote />);

    expect(screen.getByText(/do not re-grant/i)).toBeInTheDocument();
    expect(screen.getByRole('note')).toBeInTheDocument();
  });
});

describe('OverrideGrantForm — only real PremiumFeature codes are offered', () => {
  it('offers exactly the catalogue, and nothing invented', () => {
    renderWithProviders(<OverrideGrantForm userId="user-1" />);

    const select = screen.getByLabelText('Premium feature');
    const values = [...select.querySelectorAll('option')].map((o) => o.getAttribute('value'));
    // Built from `Object.values(PremiumFeature)`, the same set the server's
    // `@IsIn(Object.values(PremiumFeature))` accepts — so the form cannot compose a 422.
    expect(new Set(values)).toEqual(new Set<string>(Object.values(PremiumFeature)));
  });

  it('warns that an unenforced code will not change what the user can do', () => {
    renderWithProviders(<OverrideGrantForm userId="user-1" />);

    fireEvent.change(screen.getByLabelText('Premium feature'), {
      target: { value: PremiumFeature.PublishingPro },
    });

    expect(screen.getByText(/No server route asserts this code yet/i)).toBeInTheDocument();
  });

  it('does not warn for a code the server does enforce', () => {
    renderWithProviders(<OverrideGrantForm userId="user-1" />);

    fireEvent.change(screen.getByLabelText('Premium feature'), {
      target: { value: PremiumFeature.AiBudget },
    });

    expect(screen.queryByText(/No server route asserts this code yet/i)).not.toBeInTheDocument();
  });

  it('grants an ALLOW straight away — additive, so no confirmation', async () => {
    grant.mockResolvedValue(override());
    renderWithProviders(<OverrideGrantForm userId="user-1" />);

    fireEvent.click(screen.getByRole('button', { name: 'Grant override' }));

    await waitFor(() => {
      expect(grant).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-1', effect: OverrideEffect.Allow }),
      );
    });
  });

  it('CONFIRMS a deny before sending, because a deny removes paid-for access', async () => {
    grant.mockResolvedValue(override({ effect: OverrideEffect.Deny }));
    renderWithProviders(<OverrideGrantForm userId="user-1" />);

    fireEvent.change(screen.getByLabelText('Effect'), {
      target: { value: OverrideEffect.Deny },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Deny feature' }));

    // Not sent yet — the dialog is the gate. An override outranks the plan in BOTH directions, so a
    // deny is as destructive as a revoke and earns the same guard.
    expect(grant).not.toHaveBeenCalled();
    expect(screen.getByText(/outranks the/)).toBeInTheDocument();

    fireEvent.click(dialogButton('Deny access'));
    await waitFor(() => {
      expect(grant).toHaveBeenCalledWith(expect.objectContaining({ effect: OverrideEffect.Deny }));
    });
  });

  it('sends no expiry field at all when the operator leaves the date empty', async () => {
    grant.mockResolvedValue(override());
    renderWithProviders(<OverrideGrantForm userId="user-1" />);

    fireEvent.click(screen.getByRole('button', { name: 'Grant override' }));

    await waitFor(() => {
      expect(grant).toHaveBeenCalled();
    });
    // An empty string would be a validation error server-side; omission means "permanent".
    expect(grant.mock.calls[0]?.[0]).not.toHaveProperty('expiresAt');
  });
});

describe('OverrideTable — revoke confirms, and says which way access moves', () => {
  it('shows an honest empty state rather than a blank list', () => {
    renderWithProviders(<OverrideTable overrides={[]} />);

    expect(screen.getByText('No active overrides')).toBeInTheDocument();
    expect(screen.getByText(/come entirely from its plan/)).toBeInTheDocument();
  });

  it('does not revoke until confirmed', () => {
    renderWithProviders(<OverrideTable overrides={[override()]} />);

    fireEvent.click(screen.getByRole('button', { name: 'Revoke' }));

    expect(revoke).not.toHaveBeenCalled();
    expect(screen.getByText('Revoke this override?')).toBeInTheDocument();
  });

  it('says revoking an ALLOW may REMOVE access', () => {
    renderWithProviders(<OverrideTable overrides={[override({ effect: OverrideEffect.Allow })]} />);

    fireEvent.click(screen.getByRole('button', { name: 'Revoke' }));

    expect(screen.getByText(/may REMOVE access/)).toBeInTheDocument();
    expect(screen.queryByText(/may RESTORE access/)).not.toBeInTheDocument();
  });

  it('says revoking a DENY may RESTORE access — the opposite consequence', () => {
    renderWithProviders(<OverrideTable overrides={[override({ effect: OverrideEffect.Deny })]} />);

    fireEvent.click(screen.getByRole('button', { name: 'Revoke' }));

    // One generic "are you sure" for both directions would tell the operator nothing.
    expect(screen.getByText(/may RESTORE access/)).toBeInTheDocument();
    expect(screen.queryByText(/may REMOVE access/)).not.toBeInTheDocument();
  });

  it('carries the cache-lag caveat into the revoke confirmation too', () => {
    renderWithProviders(<OverrideTable overrides={[override()]} />);

    fireEvent.click(screen.getByRole('button', { name: 'Revoke' }));

    expect(screen.getByText(/refresh within about a minute/)).toBeInTheDocument();
  });

  it('revokes on confirm', async () => {
    revoke.mockResolvedValue(undefined);
    renderWithProviders(<OverrideTable overrides={[override()]} />);

    fireEvent.click(screen.getByRole('button', { name: 'Revoke' }));
    fireEvent.click(dialogButton('Revoke'));

    await waitFor(() => {
      expect(revoke).toHaveBeenCalledWith(OVERRIDE_ID);
    });
  });

  it('marks an unenforced code so a stale grant is not read as working', () => {
    renderWithProviders(
      <OverrideTable overrides={[override({ feature: PremiumFeature.AdvancedAnalytics })]} />,
    );

    expect(screen.getByText('not enforced')).toBeInTheDocument();
  });
});
