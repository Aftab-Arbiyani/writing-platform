import { QCard, QEmptyState, QSpinner } from '@qalam/ui';
import { ArrowRight, Gauge } from 'lucide-react';
import type { ReactElement } from 'react';
import { Link } from 'react-router';

import { ApiError } from '@/lib/api-client';
import { messageFor } from '@/lib/error-messages';
import { usePageTitle } from '@/hooks/use-page-title';
import { ROUTES } from '@/lib/routes';

import { UsageWindowCard } from '../components/usage-window-card';
import { useMonetizationUsage } from '../hooks/use-usage';
import { formatTokens, formatUsd } from '../lib/monetization-format';
import { featureLabel } from '../lib/monetization-labels';
import { isMonetizationEnabled } from '../lib/monetization-enabled';

/**
 * AI usage (`/settings/billing/usage`, AF5 W4) — ported from mobile's `usage_dashboard_screen`.
 *
 * Read-only: the server owns these counts, written by the `AI_USAGE_METER` hook as each AI request
 * completes. This is the surface that makes metering visible, which is what makes an allowance feel
 * like a budget rather than a surprise.
 *
 * **Note what this is not.** `features/ai` has its own usage read (`GET /ai/usage/me`, the AF1 token
 * telemetry) which it uses to decide whether the assistant may run. This page reads
 * `GET /monetization/usage` — the AF5 rollup, with plan limits and credit cost attached. They count
 * the same requests through different lenses and the numbers can differ while a metering write is in
 * flight; neither is wrong, and neither is derived from the other.
 *
 * As of W8 that AF1 read has a page of its own (`/settings/ai/usage`), so the two are cross-linked:
 * the overlap is visible enough that a reader comparing them needs to be told which is which, and a
 * link is the difference between "these numbers disagree" and "these count different things".
 */
export function UsagePage(): ReactElement {
  usePageTitle('AI usage');
  const enabled = isMonetizationEnabled();
  const usage = useMonetizationUsage();

  if (!enabled) {
    return (
      <QEmptyState
        icon={Gauge}
        title="Usage isn’t available yet"
        description="AI allowances arrive with subscriptions."
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h2 className="text-ink mb-1 font-serif text-xl font-semibold">AI usage</h2>
        <p className="text-ink-secondary text-sm">
          What your AI requests have consumed, and how much allowance is left.
        </p>
      </section>

      {usage.isLoading ? (
        <div className="flex justify-center py-8">
          <QSpinner />
        </div>
      ) : usage.isError ? (
        <QCard as="section">
          <p role="status" className="text-ink-secondary text-sm">
            {messageFor(usage.error instanceof ApiError ? usage.error.code : undefined)}
          </p>
        </QCard>
      ) : usage.data ? (
        <>
          {/* Named so the window cards are addressable as a group — the page renders a second list
               (the per-feature breakdown) whose items share the `listitem` role. */}
          <ul aria-label="Usage windows" className="grid gap-4 md:grid-cols-3">
            <UsageWindowCard window={usage.data.daily} />
            <UsageWindowCard window={usage.data.monthly} />
            <UsageWindowCard window={usage.data.total} />
          </ul>

          <QCard as="section" aria-labelledby="forecast-heading" className="flex flex-col gap-2">
            <h3 id="forecast-heading" className="text-ink text-base font-semibold">
              This month, projected
            </h3>
            {/*
             * A linear projection to period end, and labelled as an estimate because that is all it
             * is — the server extrapolates from spend so far, so it reads high early in a month after
             * a burst and means nothing on day one.
             */}
            <p className="text-ink-secondary text-sm">
              About {formatTokens(usage.data.forecastMonthlyTokens)} tokens, roughly{' '}
              {formatUsd(usage.data.forecastMonthlyCostUsd)} of AI cost, if this month continues at
              its current pace.
            </p>
          </QCard>

          {usage.data.byFeature.length > 0 ? (
            <section aria-labelledby="by-feature-heading" className="flex flex-col gap-3">
              <h3 id="by-feature-heading" className="text-ink text-base font-semibold">
                By feature
              </h3>
              <ul aria-label="Usage by feature" className="divide-line flex flex-col divide-y">
                {usage.data.byFeature.map((entry) => (
                  <li
                    key={entry.feature}
                    className="flex items-baseline justify-between gap-3 py-2"
                  >
                    <span className="text-ink text-sm">{featureLabel(entry.feature)}</span>
                    <span className="text-ink-muted text-sm">
                      {formatTokens(entry.tokens)} tokens · {formatTokens(entry.requests)} requests
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : (
            <p className="text-ink-muted text-sm">
              No AI requests yet — the breakdown appears once you use an AI feature.
            </p>
          )}

          {/*
           * The other lens on the same requests (W8 C3). Not a duplicate and not a replacement: this
           * page shows the plan's allowance, that one shows the AI platform's own token ledger with
           * the input/output split and the config caps. Linked so a reader who wants the second does
           * not conclude the first is wrong.
           */}
          <QCard as="section" className="flex flex-col gap-1.5">
            <p className="text-ink-secondary text-sm">
              Looking for raw token counts rather than your plan’s allowance?
            </p>
            <Link
              to={ROUTES.settingsAiUsage}
              className="text-accent focus-visible:ring-accent inline-flex w-fit items-center gap-1.5 rounded-md text-sm outline-none focus-visible:ring-2"
            >
              AI token usage
              <ArrowRight size={15} strokeWidth={1.5} aria-hidden />
            </Link>
          </QCard>
        </>
      ) : null}
    </div>
  );
}
