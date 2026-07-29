import { BillingInterval, PlanTier, isPlanUpgrade } from '@qalam/shared';
import { QButton, QCard, QTag } from '@qalam/ui';
import { Check } from 'lucide-react';
import type { ReactElement } from 'react';

import { formatMoney, formatTokens } from '../lib/monetization-format';
import { featureLabel, intervalSuffix, planLabel } from '../lib/monetization-labels';
import type { BillingInterval as Interval, PlanDefinition } from '../types/monetization.types';

export interface PlanCardProps {
  plan: PlanDefinition;
  /** The interval the comparison is showing. */
  interval: Interval;
  /** Display currency for the whole catalogue, from `PlansResponse.currency`. */
  currency: string;
  /** The viewer's current tier — decides the "Current plan" marker and the button's verb. */
  currentTier: PlanTier | string;
  busy: boolean;
  onSelect: () => void;
}

/**
 * One plan in the comparison (AF5, W4) — ported from mobile's `_PlanCard`.
 *
 * **The price is read for the shown interval and only rendered if the plan offers it.** Plan prices
 * arrive keyed interval → currency → minor units, and only the intervals a plan actually sells are
 * present: the free tier comes back as `{ none: { usd: 0 } }` (verified live), so indexing `monthly`
 * on it yields undefined, not zero. A card that printed "$0.00 / mo" for the free plan would be
 * inventing a price the catalogue never quoted.
 */
export function PlanCard({
  plan,
  interval,
  currency,
  currentTier,
  busy,
  onSelect,
}: PlanCardProps): ReactElement {
  const isCurrent = plan.tier === currentTier;
  const isFree = plan.tier === PlanTier.Free;
  const priceMinor = plan.prices[interval]?.[currency];
  const offered = priceMinor !== undefined;

  return (
    <QCard as="li" className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-ink font-serif text-lg font-semibold">{planLabel(plan.tier)}</h3>
        {isCurrent ? (
          <QTag color="accent" size="sm">
            Current plan
          </QTag>
        ) : null}
      </div>

      <p className="text-ink text-2xl font-semibold">
        {isFree ? (
          'Free'
        ) : offered ? (
          <>
            {formatMoney(priceMinor, currency)}
            <span className="text-ink-muted text-sm font-normal">
              {' / '}
              {intervalSuffix(interval)}
            </span>
          </>
        ) : (
          <span className="text-ink-muted text-base font-normal">
            Not offered {interval === BillingInterval.Yearly ? 'yearly' : 'monthly'}
          </span>
        )}
      </p>

      {plan.trialDays > 0 && !isCurrent ? (
        <p className="text-ink-secondary text-sm">{plan.trialDays}-day free trial</p>
      ) : null}

      <ul className="flex flex-col gap-1.5">
        {plan.features.map((feature) => (
          <li key={feature} className="text-ink-secondary flex items-start gap-2 text-sm">
            <Check className="text-success mt-0.5 shrink-0" size={14} aria-hidden />
            {featureLabel(feature)}
          </li>
        ))}
      </ul>

      {plan.monthlyCredits > 0 ? (
        <p className="text-ink-muted text-sm">
          {formatTokens(plan.monthlyCredits)} AI credits each month
        </p>
      ) : null}

      {/*
       * No control on the current plan and none on free: there is no "downgrade to free" route in the
       * contract — leaving the paid tiers is `cancel`, which lives on the subscription page where the
       * period-end consequence can be explained. A "Choose Free" button here would have to either lie
       * about what it does or duplicate that explanation.
       */}
      {!isFree && !isCurrent ? (
        <QButton
          variant="primary"
          block
          loading={busy}
          disabled={busy || !offered}
          onClick={onSelect}
        >
          {isPlanUpgrade(currentTier as PlanTier, plan.tier) ? 'Upgrade' : 'Switch'} to{' '}
          {planLabel(plan.tier)}
        </QButton>
      ) : null}
    </QCard>
  );
}
