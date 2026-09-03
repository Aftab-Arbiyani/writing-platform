import { EntitlementReason, EntitlementStatus, PlanTier, PremiumFeature } from '@qalam/shared';
import { screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/test/render';

import { monetizationApi } from '../api/monetization.api';
import type { EntitlementSnapshot } from '../types/monetization.types';
import { PremiumGate } from './premium-gate';

vi.mock('../api/monetization.api');
vi.mock('../lib/monetization-enabled');

const { isMonetizationEnabled } = await import('../lib/monetization-enabled');
const enabled = vi.mocked(isMonetizationEnabled);
const entitlements = vi.mocked(monetizationApi.entitlements);

function snapshot(
  feature: string,
  over: { allowed: boolean; status?: string; reason?: string; expiresAt?: string | null },
): EntitlementSnapshot {
  return {
    tier: PlanTier.Free,
    status: EntitlementStatus.Allow,
    features: [
      {
        feature: feature as never,
        status: (over.status ??
          (over.allowed ? EntitlementStatus.Allow : EntitlementStatus.Deny)) as never,
        allowed: over.allowed,
        reason: (over.reason ??
          (over.allowed
            ? EntitlementReason.PlanIncludes
            : EntitlementReason.PlanExcludes)) as never,
        expiresAt: over.expiresAt ?? null,
        remaining: null,
        limit: null,
      },
    ],
    refreshAt: null,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  enabled.mockReturnValue(true);
});

describe('PremiumGate', () => {
  it('renders its children when the server grants the feature', async () => {
    entitlements.mockResolvedValue(snapshot(PremiumFeature.AiWriting, { allowed: true }));
    renderWithProviders(
      <PremiumGate feature={PremiumFeature.AiWriting}>
        <p>Your balance</p>
      </PremiumGate>,
    );
    expect(await screen.findByText('Your balance')).toBeInTheDocument();
  });

  it('withholds its children and explains, when denied for a missing plan', async () => {
    entitlements.mockResolvedValue(snapshot(PremiumFeature.AiWriting, { allowed: false }));
    renderWithProviders(
      <PremiumGate feature={PremiumFeature.AiWriting}>
        <p>Your balance</p>
      </PremiumGate>,
    );

    expect(await screen.findByText(/needs a paid plan/i)).toBeInTheDocument();
    expect(screen.queryByText('Your balance')).not.toBeInTheDocument();
    // The remedy: an upgrade is the only thing that changes a plan exclusion.
    expect(screen.getByRole('button', { name: 'See plans' })).toBeInTheDocument();
  });

  it('offers no upgrade button for a QUOTA denial — waiting is enough', async () => {
    // The distinction the lock exists for. Selling a plan to someone whose allowance resets tomorrow is
    // misleading them into a purchase they don't need.
    entitlements.mockResolvedValue(
      snapshot(PremiumFeature.AiWriting, {
        allowed: false,
        reason: EntitlementReason.QuotaExceeded,
        expiresAt: '2026-08-01T00:00:00.000Z',
      }),
    );
    renderWithProviders(
      <PremiumGate feature={PremiumFeature.AiWriting}>
        <p>Your balance</p>
      </PremiumGate>,
    );

    expect(await screen.findByText(/used your/i)).toBeInTheDocument();
    expect(screen.getByText(/resets on/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'See plans' })).not.toBeInTheDocument();
  });

  it('fails closed when the snapshot cannot be read', async () => {
    // Being briefly too strict costs a control that appears late. Being too permissive shows a control
    // that then 402s, which reads as a broken app.
    entitlements.mockRejectedValue(new Error('boom'));
    renderWithProviders(
      <PremiumGate feature={PremiumFeature.AiWriting}>
        <p>Your balance</p>
      </PremiumGate>,
    );

    await waitFor(() => {
      expect(screen.queryByText('Your balance')).not.toBeInTheDocument();
    });
  });

  it('fails closed while the client flag is off', () => {
    enabled.mockReturnValue(false);
    renderWithProviders(
      <PremiumGate feature={PremiumFeature.AiWriting}>
        <p>Your balance</p>
      </PremiumGate>,
    );
    expect(screen.queryByText('Your balance')).not.toBeInTheDocument();
  });

  it('renders a custom locked slot when given one', async () => {
    entitlements.mockResolvedValue(snapshot(PremiumFeature.AiWriting, { allowed: false }));
    renderWithProviders(
      <PremiumGate feature={PremiumFeature.AiWriting} locked={<p>Not for you</p>}>
        <p>Your balance</p>
      </PremiumGate>,
    );
    expect(await screen.findByText('Not for you')).toBeInTheDocument();
  });

  it('renders nothing at all when the locked slot is explicitly null', async () => {
    entitlements.mockResolvedValue(snapshot(PremiumFeature.AiWriting, { allowed: false }));
    const { container } = renderWithProviders(
      <PremiumGate feature={PremiumFeature.AiWriting} locked={null}>
        <p>Your balance</p>
      </PremiumGate>,
    );
    await waitFor(() => {
      expect(screen.queryByText('Your balance')).not.toBeInTheDocument();
    });
    expect(container.textContent).toBe('');
  });

  it('shows nothing while pending by default, and the children when optimistic', async () => {
    entitlements.mockReturnValue(new Promise(() => {}));

    const strict = renderWithProviders(
      <PremiumGate feature={PremiumFeature.AiWriting}>
        <p>Strict child</p>
      </PremiumGate>,
    );
    expect(screen.queryByText('Strict child')).not.toBeInTheDocument();
    strict.unmount();

    renderWithProviders(
      <PremiumGate feature={PremiumFeature.AiWriting} optimistic>
        <p>Optimistic child</p>
      </PremiumGate>,
    );
    // Avoids a flash of lock on every page load for content the server gates anyway.
    expect(screen.getByText('Optimistic child')).toBeInTheDocument();
  });
});
