import { BillingInterval, PaymentProvider, PlanTier, isPlanDowngrade } from '@qalam/shared';
import { QCard, QEmptyState, QSpinner } from '@qalam/ui';
import { CreditCard } from 'lucide-react';
import { useState, type ReactElement } from 'react';

import { ApiError } from '@/lib/api-client';
import { messageFor } from '@/lib/error-messages';
import { usePageTitle } from '@/hooks/use-page-title';

import { CouponField } from '../components/coupon-field';
import { PaymentsUnavailable } from '../components/payments-unavailable';
import { PlanCard } from '../components/plan-card';
import { usePlans } from '../hooks/use-plans';
import {
  isPaymentsUnavailable,
  useSubscription,
  useSubscriptionActions,
} from '../hooks/use-subscription';
import { isMonetizationEnabled } from '../lib/monetization-enabled';
import type { PlanDefinition } from '../types/monetization.types';

/**
 * Plan comparison (`/settings/billing/plans`, AF5 W4) — ported from mobile's `plans_screen`.
 *
 * **Two different writes hide behind one button, and which one fires depends on whether a
 * subscription exists.** With none, this is `POST /subscription` — a checkout, which answers a
 * provider URL to send the reader to. With one, it is `POST /subscription/change`, which needs no
 * payment round-trip because the provider already has a mandate. Mobile makes the same split; getting
 * it wrong means either charging an existing subscriber twice or asking a new one to change a plan
 * they never had.
 *
 * **A downgrade is scheduled, an upgrade is immediate.** `atPeriodEnd` is set from the tier
 * comparison, so someone moving down keeps what they paid for until the period ends and someone moving
 * up gets it now, prorated. That is the contract's intent for the flag and not a preference.
 */
export function PlansPage(): ReactElement {
  usePageTitle('Plans');
  const enabled = isMonetizationEnabled();
  const [yearly, setYearly] = useState(false);
  const [coupon, setCoupon] = useState<string | null>(null);

  const interval = yearly ? BillingInterval.Yearly : BillingInterval.Monthly;
  const plans = usePlans();
  const subscription = useSubscription();
  const { subscribe, changePlan } = useSubscriptionActions();

  if (!enabled) {
    return (
      <QEmptyState
        icon={CreditCard}
        title="Plans aren’t available yet"
        description="Subscriptions arrive with the next release."
      />
    );
  }

  const currentTier = subscription.data?.tier ?? PlanTier.Free;
  const hasSubscription = subscription.data != null;
  const busy = subscribe.isPending || changePlan.isPending;
  const failure = subscribe.error ?? changePlan.error;
  const checkout = subscribe.data;

  const select = (plan: PlanDefinition): void => {
    if (hasSubscription) {
      changePlan.mutate({
        tier: plan.tier,
        interval,
        atPeriodEnd: isPlanDowngrade(currentTier, plan.tier),
      });
      return;
    }
    subscribe.mutate({
      tier: plan.tier,
      interval,
      // Stripe is the only browser-reachable provider: the store adapters activate from a receipt that
      // only exists on a device, so a card checkout is the web's single path.
      provider: PaymentProvider.Stripe,
      couponCode: coupon ?? undefined,
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h2 className="text-ink mb-1 font-serif text-xl font-semibold">Plans</h2>
        <p className="text-ink-secondary text-sm">
          Every plan includes the whole writing app. Paid tiers raise how much you can use each
          writing tool.
        </p>
      </section>

      <IntervalToggle yearly={yearly} onChange={setYearly} />

      {plans.isLoading ? (
        <div className="flex justify-center py-8">
          <QSpinner />
        </div>
      ) : plans.isError ? (
        <QCard as="section">
          <p role="status" className="text-ink-secondary text-sm">
            {messageFor(plans.error instanceof ApiError ? plans.error.code : undefined)}
          </p>
        </QCard>
      ) : plans.data ? (
        <ul aria-label="Plans" className="grid gap-4 md:grid-cols-2">
          {plans.data.plans.map((plan) => (
            <PlanCard
              key={plan.tier}
              plan={plan}
              interval={interval}
              currency={plans.data.currency}
              currentTier={currentTier}
              busy={busy}
              onSelect={() => {
                select(plan);
              }}
            />
          ))}
        </ul>
      ) : null}

      {/*
       * A promo code applies to a NEW subscription only, and the field is hidden from existing
       * subscribers rather than ignored for them.
       *
       * `@qalam/api-types` declares `couponCode` on `ChangePlanRequest`, but the backend's
       * `ChangePlanDto` has no such property and the app runs
       * `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })` — so sending it would 400
       * the whole plan change, not be politely dropped. That is the same trap mobile's M-1 invite
       * defect fell into, one package-level type away (docs/48 §3.6, W4-5).
       */}
      {!hasSubscription && plans.data ? (
        <QCard as="section" aria-labelledby="coupon-heading" className="flex flex-col gap-3">
          <h3 id="coupon-heading" className="text-ink text-base font-semibold">
            Have a promo code?
          </h3>
          <CouponField
            tier={undefined}
            interval={interval}
            currency={plans.data.currency}
            onApplied={setCoupon}
          />
        </QCard>
      ) : null}

      {failure ? (
        isPaymentsUnavailable(failure) ? (
          <PaymentsUnavailable error={failure} />
        ) : (
          <QCard as="section">
            <p role="status" className="text-danger text-sm">
              {messageFor(failure instanceof ApiError ? failure.code : undefined)}
            </p>
          </QCard>
        )
      ) : null}

      {/*
       * A checkout that answered a URL. Rendered as a link rather than an automatic redirect: an
       * unannounced navigation to a third-party payment page is disorienting, and on this stack the
       * branch is unreachable anyway (no provider is configured), so it must degrade to something
       * honest rather than a blank tab.
       */}
      {checkout?.checkoutUrl != null ? (
        <QCard as="section" aria-labelledby="checkout-heading" className="flex flex-col gap-2">
          <h3 id="checkout-heading" className="text-ink text-base font-semibold">
            Finish your purchase
          </h3>
          <p className="text-ink-secondary text-sm">
            Your plan is reserved. Complete the secure checkout to activate it.
          </p>
          <a
            href={checkout.checkoutUrl}
            rel="noopener noreferrer"
            className="text-accent text-sm font-medium underline"
          >
            Continue to checkout
          </a>
        </QCard>
      ) : null}

      {changePlan.isSuccess ? (
        <p role="status" className="text-success text-sm">
          Your plan has been updated.
        </p>
      ) : null}
    </div>
  );
}

/**
 * Monthly / yearly. A `radiogroup` rather than two buttons or a switch: it is a choice between two
 * named options where exactly one is active, which is what radio semantics say, and a switch would
 * imply "yearly" is an on/off modifier of a single price.
 */
function IntervalToggle({
  yearly,
  onChange,
}: {
  yearly: boolean;
  onChange: (yearly: boolean) => void;
}): ReactElement {
  return (
    <div
      role="radiogroup"
      aria-label="Billing interval"
      className="border-line inline-flex rounded-md border p-0.5"
    >
      {[
        { label: 'Monthly', value: false },
        { label: 'Yearly', value: true },
      ].map((option) => (
        <button
          key={option.label}
          type="button"
          role="radio"
          aria-checked={yearly === option.value}
          onClick={() => {
            onChange(option.value);
          }}
          className={
            yearly === option.value
              ? 'bg-raised text-ink min-h-9 rounded-sm px-4 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-accent'
              : 'text-ink-secondary hover:text-ink min-h-9 rounded-sm px-4 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent'
          }
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
