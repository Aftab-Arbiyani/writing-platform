import { BillingInterval, PlanTier, SubscriptionStatus } from '@qalam/shared';
import { QButton, QCard, QEmptyState, QSpinner, QTag } from '@qalam/ui';
import { CreditCard, Gauge, Receipt, Sparkles } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactElement } from 'react';
import { Link, useNavigate } from 'react-router';

import { ApiError } from '@/lib/api-client';
import { messageFor } from '@/lib/error-messages';
import { formatDate } from '@/lib/format';
import { usePageTitle } from '@/hooks/use-page-title';
import { ROUTES } from '@/lib/routes';

import { PaymentsUnavailable } from '../components/payments-unavailable';
import { PremiumBadge } from '../components/premium-badge';
import { SubscriptionStatusBanner } from '../components/subscription-status-banner';
import { useEntitlements } from '../hooks/use-entitlements';
import {
  isPaymentsUnavailable,
  useSubscription,
  useSubscriptionActions,
} from '../hooks/use-subscription';
import { isPremium } from '../lib/entitlement-decisions';
import { isMonetizationEnabled } from '../lib/monetization-enabled';
import { intervalLabel, planLabel, subscriptionStatusLabel } from '../lib/monetization-labels';
import type { SubscriptionResponse } from '../types/monetization.types';

/**
 * The monetization hub (`/settings/billing`, AF5 W4) — ported from mobile's `subscription_screen`,
 * which it calls "the monetization home".
 *
 * It is the only monetization entry in the settings nav; usage, history and the plan
 * comparison are reached from here, exactly as mobile's `_navTiles` do. That keeps the settings nav
 * one-entry-per-section like every other tab, and it matches how the data reads: all four are facts
 * about the subscription this page is about.
 *
 * A free viewer sees an upsell rather than an empty subscription card — `GET /monetization/subscription`
 * 404s for them (the ordinary majority state, mapped to `null` by the hook), and the useful thing to
 * show someone with no plan is what the plans are.
 */
export function SubscriptionPage(): ReactElement {
  usePageTitle('Billing');
  const enabled = isMonetizationEnabled();
  const subscription = useSubscription();
  const entitlements = useEntitlements();

  if (!enabled) {
    return (
      <QEmptyState
        icon={CreditCard}
        title="Plans aren’t available yet"
        description="Subscriptions arrive with the next release."
      />
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <section>
        <h2 className="text-ink mb-1 font-serif text-xl font-semibold">Billing</h2>
        <p className="text-ink-secondary text-sm">
          Your plan, what it includes, and what you’ve used.
        </p>
      </section>

      {subscription.isLoading ? (
        <div className="flex justify-center py-8">
          <QSpinner />
        </div>
      ) : subscription.isError ? (
        <QCard as="section">
          <p role="status" className="text-ink-secondary text-sm">
            {messageFor(
              subscription.error instanceof ApiError ? subscription.error.code : undefined,
            )}
          </p>
        </QCard>
      ) : subscription.data == null ? (
        // `== null` covers both the mapped 404 (genuinely no subscription — the ordinary free state)
        // and the unreachable settled-but-undefined case, which resolve to the same surface anyway.
        <FreePlanCard />
      ) : (
        <>
          <SubscriptionStatusBanner subscription={subscription.data} />
          <PlanSummaryCard subscription={subscription.data} />
          <SubscriptionActions subscription={subscription.data} />
        </>
      )}

      {/*
       * The tier line comes from the entitlement snapshot, not the subscription: the snapshot is what
       * every gate reads, and an admin override or a promotion can grant premium access with no
       * subscription row behind it. Reading the subscription here would tell a comped account it is on
       * free while its features work.
       */}
      {entitlements.data && subscription.data === null && isPremium(entitlements.data) ? (
        <QCard as="section">
          <p className="text-ink-secondary text-sm">
            Your account has {planLabel(entitlements.data.tier)} features without a subscription.
          </p>
        </QCard>
      ) : null}

      <BillingNav />
    </div>
  );
}

function FreePlanCard(): ReactElement {
  const navigate = useNavigate();
  return (
    <QCard as="section" aria-labelledby="free-plan-heading" className="flex flex-col gap-3">
      <h3 id="free-plan-heading" className="text-ink font-serif text-lg font-semibold">
        You’re on the Free plan
      </h3>
      <p className="text-ink-secondary text-sm">
        A paid plan raises how much you can use each writing tool.
      </p>
      <div>
        <QButton
          variant="primary"
          icon={Sparkles}
          onClick={() => {
            void navigate(ROUTES.settingsBillingPlans);
          }}
        >
          Compare plans
        </QButton>
      </div>
    </QCard>
  );
}

function PlanSummaryCard({
  subscription: sub,
}: {
  subscription: SubscriptionResponse;
}): ReactElement {
  const interval = intervalLabel(sub.interval);
  return (
    <QCard as="section" aria-labelledby="plan-summary-heading" className="flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <h3
          id="plan-summary-heading"
          className="text-ink flex items-center gap-2 font-serif text-lg font-semibold"
        >
          {planLabel(sub.tier)} plan
          {/* Annotates, never gates — the tier the viewer is actually on. */}
          {sub.tier !== PlanTier.Free ? <PremiumBadge tier={sub.tier} /> : null}
        </h3>
        <QTag color={statusTone(sub.status)} size="sm">
          {subscriptionStatusLabel(sub.status)}
        </QTag>
      </div>
      <dl className="text-ink-secondary flex flex-col gap-1 text-sm">
        {/* `none` is a real interval value meaning "not recurring"; "Billed none" is nonsense. */}
        {sub.interval !== BillingInterval.None && interval !== '' ? (
          <div className="flex gap-2">
            <dt className="text-ink-muted">Billing</dt>
            <dd>{interval.toLowerCase()}</dd>
          </div>
        ) : null}
        {sub.currentPeriodEnd === null ? null : (
          <div className="flex gap-2">
            <dt className="text-ink-muted">{sub.cancelAtPeriodEnd ? 'Access until' : 'Renews'}</dt>
            <dd>{formatDate(sub.currentPeriodEnd)}</dd>
          </div>
        )}
        <div className="flex gap-2">
          <dt className="text-ink-muted">Auto-renew</dt>
          <dd>{sub.autoRenew ? 'On' : 'Off'}</dd>
        </div>
      </dl>
    </QCard>
  );
}

/** The tag colour for a lifecycle status. Only the states that need alarm get it. */
function statusTone(status: string): 'success' | 'warning' | 'danger' | 'neutral' {
  switch (status) {
    case SubscriptionStatus.Active:
      return 'success';
    case SubscriptionStatus.Trialing:
      return 'neutral';
    case SubscriptionStatus.Paused:
    case SubscriptionStatus.PendingActivation:
      return 'warning';
    case SubscriptionStatus.PastDue:
    case SubscriptionStatus.GracePeriod:
    case SubscriptionStatus.Canceled:
    case SubscriptionStatus.Expired:
      return 'danger';
    default:
      return 'neutral';
  }
}

/**
 * Cancel / reactivate / pause / resume (AF5, W4).
 *
 * **Which controls appear is derived from the lifecycle state, not from a fixed list**, because the
 * server refuses the transitions that do not apply (`SUBSCRIPTION_INVALID_TRANSITION`) — resuming a
 * subscription that is not paused, reactivating one that is not cancelling. Rendering all four always
 * and letting the server reject three of them is precisely the dead-button failure W3c-1 was.
 *
 * **Restore purchases is absent, and that is the contract's decision rather than an omission.**
 * `POST /monetization/purchases/restore` requires a store receipt, which only exists on a device; a
 * browser has nothing to send. Mobile shows the button because mobile can (its gateway is inert, so it
 * reports unavailable — but the affordance makes sense there). On the web it could only ever fail.
 */
function SubscriptionActions({
  subscription: sub,
}: {
  subscription: SubscriptionResponse;
}): ReactElement {
  const navigate = useNavigate();
  const { cancel, reactivate, pause, resume } = useSubscriptionActions();
  const busy = cancel.isPending || reactivate.isPending || pause.isPending || resume.isPending;

  const canReactivate =
    sub.cancelAtPeriodEnd ||
    sub.status === SubscriptionStatus.Canceled ||
    sub.status === SubscriptionStatus.Expired;
  const canPause = sub.status === SubscriptionStatus.Active && !sub.cancelAtPeriodEnd;
  const canCancel =
    !sub.cancelAtPeriodEnd &&
    (sub.status === SubscriptionStatus.Active ||
      sub.status === SubscriptionStatus.Trialing ||
      sub.status === SubscriptionStatus.PastDue ||
      sub.status === SubscriptionStatus.GracePeriod);

  const failure = [cancel.error, reactivate.error, pause.error, resume.error].find(
    (error) => error != null,
  );

  return (
    <QCard as="section" aria-labelledby="plan-actions-heading" className="flex flex-col gap-3">
      <h3 id="plan-actions-heading" className="text-ink text-base font-semibold">
        Manage
      </h3>

      <div className="flex flex-wrap gap-2">
        <QButton
          disabled={busy}
          onClick={() => {
            void navigate(ROUTES.settingsBillingPlans);
          }}
        >
          Change plan
        </QButton>

        {sub.status === SubscriptionStatus.Paused ? (
          <QButton
            variant="primary"
            loading={resume.isPending}
            disabled={busy}
            onClick={() => {
              resume.mutate();
            }}
          >
            Resume
          </QButton>
        ) : null}

        {canReactivate ? (
          <QButton
            variant="primary"
            loading={reactivate.isPending}
            disabled={busy}
            onClick={() => {
              reactivate.mutate();
            }}
          >
            Reactivate
          </QButton>
        ) : null}

        {canPause ? (
          <QButton
            loading={pause.isPending}
            disabled={busy}
            onClick={() => {
              pause.mutate();
            }}
          >
            Pause
          </QButton>
        ) : null}

        {canCancel ? (
          <QButton
            variant="danger"
            loading={cancel.isPending}
            disabled={busy}
            onClick={() => {
              cancel.mutate({});
            }}
          >
            Cancel plan
          </QButton>
        ) : null}
      </div>

      {/*
       * The consequence, stated where the control is rather than behind a confirmation dialog. Cancel
       * defaults to period end, so nothing is lost at the moment of the click and there is nothing to
       * guard against — a dialog here would be ceremony, and the action is reversible with the
       * Reactivate button that replaces it.
       */}
      {canCancel ? (
        <p className="text-ink-muted text-xs">
          Cancelling keeps your plan until
          {sub.currentPeriodEnd === null
            ? ' the end of the current period'
            : ` ${formatDate(sub.currentPeriodEnd)}`}
          .
        </p>
      ) : null}

      {failure ? (
        isPaymentsUnavailable(failure) ? (
          <PaymentsUnavailable error={failure} />
        ) : (
          <p role="status" className="text-danger text-sm">
            {messageFor(failure instanceof ApiError ? failure.code : undefined)}
          </p>
        )
      ) : null}
    </QCard>
  );
}

const NAV: readonly { to: string; label: string; description: string; icon: LucideIcon }[] = [
  {
    to: ROUTES.settingsBillingPlans,
    label: 'Plans',
    description: 'Compare tiers and switch',
    icon: Sparkles,
  },
  {
    to: ROUTES.settingsBillingUsage,
    label: 'Usage',
    description: 'What you’ve used of each tool',
    icon: Gauge,
  },
  {
    to: ROUTES.settingsBillingHistory,
    label: 'Billing history',
    description: 'Invoices, payments and purchases',
    icon: Receipt,
  },
];

function BillingNav(): ReactElement {
  return (
    <nav aria-label="Billing sections">
      <ul className="flex flex-col gap-2">
        {NAV.map(({ to, label, description, icon: Icon }) => (
          <QCard as="li" key={to} interactive padding="none">
            <Link
              to={to}
              className="flex min-h-14 items-center gap-3 rounded-md px-4 py-3 outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <Icon size={18} strokeWidth={1.5} className="text-ink-muted shrink-0" aria-hidden />
              <span className="flex min-w-0 flex-col">
                <span className="text-ink text-sm font-medium">{label}</span>
                <span className="text-ink-muted text-xs">{description}</span>
              </span>
            </Link>
          </QCard>
        ))}
      </ul>
    </nav>
  );
}
