import { QCard, QSectionHeader, QTag } from '@qalam/ui';
import type { ReactElement } from 'react';

import { formatDateTime } from '@/lib/format';

import type { AdminUserSubscription } from '../types/monetization.types';

/**
 * One account's subscription (B8, closing A1-7).
 *
 * **The free case is not an error and does not look like one.** `subscription: null` is the
 * platform's commonest account state, so it renders as a plain statement in the same card, with the
 * same weight, as a paying account's detail — no warning colour, no alert role, nothing that would
 * send an operator looking for a problem that is not there.
 *
 * **The compensating sentence is gone (B8-1 closed).** This card used to add "a user ID that does not
 * exist reads the same way… confirm the ID on the Users screen", because the four admin per-account
 * reads answered a nullable shape for an id belonging to nobody. They now `404 USER_NOT_FOUND`, so a
 * null here means exactly one thing — this account is on free — and copy explaining an ambiguity that
 * no longer exists would send an operator to check something the server already checked.
 */
export interface AccountSubscriptionProps {
  result: AdminUserSubscription;
}

export function AccountSubscription({ result }: AccountSubscriptionProps): ReactElement {
  const subscription = result.subscription;

  if (subscription === null) {
    return (
      <QCard as="section" padding="lg" className="flex flex-col gap-2">
        <QSectionHeader title="Free plan" />
        <p className="text-sm text-ink-secondary">
          This account has no subscription record, which is what the free plan looks like &mdash;
          most accounts are here. Its premium access, if any, comes from an entitlement override.
        </p>
      </QCard>
    );
  }

  const rows: Array<[string, string]> = [
    ['Status', subscription.status],
    ['Tier', subscription.tier],
    ['Billing interval', subscription.interval],
    ['Provider', subscription.provider],
    ['Currency', subscription.currency.toUpperCase()],
    ['Auto-renew', subscription.autoRenew ? 'on' : 'off'],
    [
      'Current period',
      subscription.currentPeriodStart === null || subscription.currentPeriodEnd === null
        ? 'not started'
        : `${formatDateTime(subscription.currentPeriodStart)} → ${formatDateTime(subscription.currentPeriodEnd)}`,
    ],
    ['Trial ends', subscription.trialEnd === null ? '—' : formatDateTime(subscription.trialEnd)],
    [
      'Grace period ends',
      subscription.gracePeriodEnd === null ? '—' : formatDateTime(subscription.gracePeriodEnd),
    ],
    [
      'Cancelled at',
      subscription.canceledAt === null ? '—' : formatDateTime(subscription.canceledAt),
    ],
    ['Started', formatDateTime(subscription.createdAt)],
  ];

  return (
    <QCard as="section" padding="lg" className="flex flex-col gap-4">
      <QSectionHeader title="Subscription" description={subscription.id} />

      <div className="flex flex-wrap items-center gap-2">
        <QTag color={subscription.status === 'active' ? 'success' : 'neutral'}>
          {subscription.status}
        </QTag>
        <QTag color="info">{subscription.tier}</QTag>
        {subscription.cancelAtPeriodEnd ? (
          // Distinct from a cancelled subscription: this one is still active and still granting
          // access, and it will stop on its own. An operator chasing "why do they still have Pro"
          // needs to see the difference.
          <QTag color="warning">cancels at period end</QTag>
        ) : null}
        {subscription.scheduledTier === null ? null : (
          <QTag color="warning">
            switches to {subscription.scheduledTier}
            {subscription.scheduledInterval === null ? '' : ` (${subscription.scheduledInterval})`}
          </QTag>
        )}
      </div>

      <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <div
            key={label}
            className="flex items-baseline justify-between gap-3 border-b border-line pb-1"
          >
            <dt className="text-xs uppercase tracking-wide text-ink-secondary">{label}</dt>
            <dd className="text-sm text-ink">{value}</dd>
          </div>
        ))}
      </dl>
    </QCard>
  );
}
