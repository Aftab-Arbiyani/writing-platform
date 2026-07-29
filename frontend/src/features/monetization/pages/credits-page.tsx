import { PremiumFeature } from '@qalam/shared';
import { QButton, QCard, QEmptyState, QSpinner } from '@qalam/ui';
import { Coins } from 'lucide-react';
import type { ReactElement } from 'react';
import { useNavigate } from 'react-router';

import { ApiError } from '@/lib/api-client';
import { messageFor } from '@/lib/error-messages';
import { formatDateTime } from '@/lib/format';
import { usePageTitle } from '@/hooks/use-page-title';
import { ROUTES } from '@/lib/routes';

import { PremiumGate } from '../components/premium-gate';
import { useCreditBalance, useCreditLedger } from '../hooks/use-credits';
import { formatCreditDelta, formatTokens, formatUsd } from '../lib/monetization-format';
import { creditReasonLabel, featureLabel } from '../lib/monetization-labels';
import { isMonetizationEnabled } from '../lib/monetization-enabled';

/**
 * AI credits (`/settings/billing/credits`, AF5 W4) — ported from mobile's `credit_dashboard_screen`.
 *
 * **The credit packs mobile offers are absent here, and that is the contract's decision.**
 * `POST /monetization/credits/purchase` rejects a missing or empty `receipt` with
 * `RECEIPT_VALIDATION_FAILED` before it reaches a provider (`monetization.controller.ts#purchaseCredits`),
 * and a receipt only exists after a purchase completes inside an app store on a device. So there is no
 * browser path to buying credits at all — not one that is unconfigured, one that does not exist. Mobile
 * shows three packs because a phone can produce a receipt.
 *
 * Rather than render buttons that could only ever fail, this says where credits come from on the web: a
 * paid plan grants them monthly. That is true, actionable, and one link away.
 */
export function CreditsPage(): ReactElement {
  usePageTitle('AI credits');
  const navigate = useNavigate();
  const enabled = isMonetizationEnabled();
  const balance = useCreditBalance();
  const ledger = useCreditLedger();

  if (!enabled) {
    return (
      <QEmptyState
        icon={Coins}
        title="Credits aren’t available yet"
        description="AI credits arrive with subscriptions."
      />
    );
  }

  const rows = ledger.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h2 className="text-ink mb-1 font-serif text-xl font-semibold">AI credits</h2>
        <p className="text-ink-secondary text-sm">
          Credits pay for AI requests beyond your plan’s token allowance.
        </p>
      </section>

      {balance.isLoading ? (
        <div className="flex justify-center py-8">
          <QSpinner />
        </div>
      ) : balance.isError ? (
        <QCard as="section">
          <p role="status" className="text-ink-secondary text-sm">
            {messageFor(balance.error instanceof ApiError ? balance.error.code : undefined)}
          </p>
        </QCard>
      ) : balance.data ? (
        /*
         * Gated on `ai_budget` — the one premium feature the server actually enforces
         * (`AiUsageMeterService.checkQuota` asserts it before every generation, the only
         * `assertAllowed` call in the backend).
         *
         * This is a real gate rather than decoration: credits are only spendable through an AI
         * request, so an account whose `ai_budget` is denied — a deny override, or a suspended
         * standing — cannot spend a single one. Announcing "you have 5,000 credits" to someone the
         * server will refuse on every request is the misleading half of the W3c-1 defect class, and
         * the gate replaces it with the reason.
         *
         * Free accounts pass: `DEFAULT_PLAN_FEATURES` grants the free tier `ai_budget`, confirmed
         * live (`allowed: true, reason: plan_includes`). So this withholds nothing from the ordinary
         * viewer, and the surrounding page already handles the flag-off case above, which means the
         * gate is never the thing that hides a working balance.
         */
        <PremiumGate feature={PremiumFeature.AiBudget} optimistic>
          <QCard as="section" aria-labelledby="balance-heading" className="flex flex-col gap-2">
            <h3 id="balance-heading" className="text-ink text-sm font-semibold">
              Balance
            </h3>
            <p className="text-ink text-3xl font-semibold">{formatTokens(balance.data.balance)}</p>
            <p className="text-ink-secondary text-sm">
              {formatTokens(balance.data.lifetimeGranted)} granted ·{' '}
              {formatTokens(balance.data.lifetimeConsumed)} used
            </p>
            {/*
             * The conversion rate, stated because it is the only thing that makes a credit balance
             * meaningful — 5,000 credits means nothing until you know it is $50 of AI spend.
             */}
            <p className="text-ink-muted text-xs">
              {formatTokens(balance.data.creditsPerUsd)} credits ≈ {formatUsd(1)} of AI usage.
            </p>
          </QCard>
        </PremiumGate>
      ) : null}

      <QCard as="section" aria-labelledby="get-credits-heading" className="flex flex-col gap-3">
        <h3 id="get-credits-heading" className="text-ink text-base font-semibold">
          Getting more credits
        </h3>
        <p className="text-ink-secondary text-sm">
          Paid plans include a monthly credit grant. Buying a one-off credit pack is only possible
          in the mobile app, where a store handles the purchase.
        </p>
        <div>
          <QButton
            onClick={() => {
              void navigate(ROUTES.settingsBillingPlans);
            }}
          >
            See plans
          </QButton>
        </div>
      </QCard>

      <section aria-labelledby="ledger-heading" className="flex flex-col gap-3">
        <h3 id="ledger-heading" className="text-ink text-base font-semibold">
          Activity
        </h3>

        {ledger.isLoading ? (
          <div className="flex justify-center py-6">
            <QSpinner />
          </div>
        ) : ledger.isError ? (
          <p role="status" className="text-ink-secondary text-sm">
            {messageFor(ledger.error instanceof ApiError ? ledger.error.code : undefined)}
          </p>
        ) : rows.length === 0 ? (
          <p className="text-ink-muted text-sm">Nothing yet.</p>
        ) : (
          <>
            <ul className="divide-line flex flex-col divide-y">
              {rows.map((row) => (
                <li key={row.id} className="flex items-start justify-between gap-3 py-2.5">
                  <div className="flex min-w-0 flex-col">
                    <span className="text-ink text-sm">{creditReasonLabel(row.reason)}</span>
                    <span className="text-ink-muted text-xs">
                      {formatDateTime(row.createdAt)}
                      {row.feature === null ? null : ` · ${featureLabel(row.feature)}`}
                      {row.tokens > 0 ? ` · ${formatTokens(row.tokens)} tokens` : null}
                    </span>
                  </div>
                  <div className="flex shrink-0 flex-col items-end">
                    {/*
                     * Sign, not colour alone: a debit and a grant must be distinguishable without
                     * relying on hue, and `formatCreditDelta` prefixes both.
                     */}
                    <span
                      className={
                        row.delta < 0
                          ? 'text-ink text-sm font-medium'
                          : 'text-success text-sm font-medium'
                      }
                    >
                      {formatCreditDelta(row.delta)}
                    </span>
                    <span className="text-ink-muted text-xs">
                      {formatTokens(row.balanceAfter)} left
                    </span>
                  </div>
                </li>
              ))}
            </ul>

            {ledger.hasNextPage ? (
              <div>
                <QButton
                  loading={ledger.isFetchingNextPage}
                  disabled={ledger.isFetchingNextPage}
                  onClick={() => {
                    void ledger.fetchNextPage();
                  }}
                >
                  Load more
                </QButton>
              </div>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}
