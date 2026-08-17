import { QButton, QTag, useToast } from '@qalam/ui';
import type { ReactElement } from 'react';

import { EmptyState } from '@/components/empty-state';
import { getErrorMessage } from '@/lib/errors';
import { formatDateTime } from '@/lib/format';

import { useUpdateCoupon } from '../hooks/use-monetization';
import type { AdminCoupon } from '../types/monetization.types';

/**
 * Existing coupons, with the one edit that matters operationally: activate / deactivate (A1b).
 *
 * `PATCH coupons/:id` also accepts `value`, `maxRedemptions`, `description` and `expiresAt`, but
 * toggling `active` is what an operator reaches for — a coupon leaking discounts needs to stop NOW,
 * and editing its value mid-campaign changes what earlier redeemers got versus later ones. The other
 * fields are reachable through the same endpoint whenever a row asks for them; this ships the urgent
 * one rather than a generic edit modal nobody asked for.
 *
 * Deactivation is not confirmed: it is reversible in one click and stops money leaving rather than
 * causing it to. Reserving the confirm dialog for the irreversible actions is what keeps it meaningful.
 */
export interface CouponTableProps {
  coupons: AdminCoupon[];
}

export function CouponTable({ coupons }: CouponTableProps): ReactElement {
  const toast = useToast();
  const update = useUpdateCoupon();

  if (coupons.length === 0) {
    return (
      <EmptyState
        title="No coupons yet"
        description="Created coupons appear here with their redemption counts."
        minHeight={200}
      />
    );
  }

  const toggle = (coupon: AdminCoupon): void => {
    update.mutate(
      { id: coupon.id, patch: { active: !coupon.active } },
      {
        onSuccess: (next) => {
          toast.success(`${next.code} is now ${next.active ? 'active' : 'inactive'}.`);
        },
        onError: (error) => toast.error(getErrorMessage(error)),
      },
    );
  };

  return (
    <ul className="flex flex-col divide-y divide-line">
      {coupons.map((coupon) => (
        <li
          key={coupon.id}
          className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 py-3"
        >
          <div className="flex min-w-0 flex-col gap-1">
            <span className="flex flex-wrap items-center gap-2">
              <code className="font-mono text-sm font-medium text-ink">{coupon.code}</code>
              <QTag color={coupon.active ? 'success' : 'neutral'}>
                {coupon.active ? 'active' : 'inactive'}
              </QTag>
              <QTag color="info">{coupon.type}</QTag>
              {coupon.expiresAt !== null && new Date(coupon.expiresAt) < new Date() ? (
                // Distinct from `inactive`: an expired coupon is still flagged active server-side but
                // will not redeem, and an operator hunting "why won't this work" needs to see it.
                <QTag color="warning">expired</QTag>
              ) : null}
            </span>
            <span className="text-xs text-ink-muted [font-variant-numeric:tabular-nums]">
              value {coupon.value.toLocaleString()} &middot; redeemed{' '}
              {coupon.redemptions.toLocaleString()}
              {coupon.maxRedemptions === 0
                ? ' of unlimited'
                : ` of ${coupon.maxRedemptions.toLocaleString()}`}
              {coupon.expiresAt === null
                ? ' · no expiry'
                : ` · expires ${formatDateTime(coupon.expiresAt)}`}
            </span>
            {coupon.campaign === null ? null : (
              <span className="text-xs text-ink-secondary">{coupon.campaign}</span>
            )}
          </div>
          <QButton
            variant="secondary"
            size="sm"
            loading={update.isPending && update.variables?.id === coupon.id}
            onClick={() => {
              toggle(coupon);
            }}
          >
            {coupon.active ? 'Deactivate' : 'Activate'}
          </QButton>
        </li>
      ))}
    </ul>
  );
}
