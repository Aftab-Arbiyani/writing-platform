import { QCard, QSpinner } from '@qalam/ui';
import { ArrowRight } from 'lucide-react';
import type { ReactElement } from 'react';
import { Link } from 'react-router';

import { env } from '@/config/env';
import { usePageTitle } from '@/hooks/use-page-title';
import { getErrorMessage } from '@/lib/errors';
import { ROUTES } from '@/lib/routes';

import { AiUsageWindowCard } from '../components/ai-usage-window-card';
import { useAiUsage } from '../hooks/use-ai-meta';
import { featureLabel } from '../lib/conversation-labels';

/**
 * AI token usage (`/settings/ai/usage`, W8 C3) — ported from mobile's `ai_usage_screen`, reading the
 * AF1 route `GET /ai/usage/me`.
 *
 * **This is not the billing usage page, and the distinction is load-bearing.**
 * `/settings/billing/usage` (W4) reads `GET /monetization/usage` — the AF5 rollup, with plan limits
 * and credit cost attached. This page reads the AI platform's own token accounting: the ledger
 * `UsageService` writes as each call completes (`usage.service.ts:57-72`) and aggregates over
 * day / month / lifetime windows (`:95-139`), with the caps that come from `aiConfig`, not from a plan.
 *
 * They count the same requests through different lenses and can disagree while a metering write is in
 * flight; neither is derived from the other. Mobile ships both screens for the same reason. The two
 * pages cross-link so a reader who lands on the wrong one can get to the right one instead of
 * concluding the numbers are broken — and the link is one-way when monetization is dark-launched,
 * since the billing page renders "not available yet" behind that flag.
 */
export function AiUsagePage(): ReactElement {
  usePageTitle('AI token usage');
  const usage = useAiUsage();

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h2 className="text-ink mb-1 font-serif text-xl font-semibold">AI token usage</h2>
        <p className="text-ink-secondary text-sm">
          What the AI platform has recorded against your account, and how much of each cap is left.
        </p>
      </section>

      {usage.isLoading ? (
        <div className="flex justify-center py-8">
          <QSpinner />
        </div>
      ) : usage.isError ? (
        <QCard as="section">
          <p role="status" className="text-ink-secondary text-sm">
            {getErrorMessage(usage.error)}
          </p>
        </QCard>
      ) : usage.data === undefined ? null : (
        <>
          <ul aria-label="Token usage windows" className="grid gap-4 md:grid-cols-3">
            <AiUsageWindowCard label="Today" window={usage.data.daily} />
            <AiUsageWindowCard label="This month" window={usage.data.monthly} />
            <AiUsageWindowCard label="All time" window={usage.data.total} />
          </ul>

          <section aria-labelledby="ai-by-feature-heading" className="flex flex-col gap-3">
            <h3 id="ai-by-feature-heading" className="text-ink text-base font-semibold">
              By feature
            </h3>
            {usage.data.byFeature.length === 0 ? (
              <p className="text-ink-muted text-sm">
                No AI requests recorded yet — the breakdown appears once you use an AI feature.
              </p>
            ) : (
              <ul
                aria-label="Token usage by feature"
                className="divide-line flex flex-col divide-y"
              >
                {usage.data.byFeature.map((entry) => (
                  <li
                    key={entry.feature}
                    className="flex items-baseline justify-between gap-3 py-2"
                  >
                    <span className="text-ink text-sm">{featureLabel(entry.feature)}</span>
                    <span className="text-ink-muted text-sm">
                      {entry.totalTokens.toLocaleString()} tokens ·{' '}
                      {entry.requests.toLocaleString()}{' '}
                      {entry.requests === 1 ? 'request' : 'requests'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {/* Lifetime, not windowed: `featureBreakdown` takes no `since` (usage.service.ts:100). */}
            <p className="text-ink-muted text-xs">Lifetime totals, across every window above.</p>
          </section>

          {env.VITE_ENABLE_MONETIZATION === 'true' ? (
            <QCard as="section" className="flex flex-col gap-1.5">
              <p className="text-ink-secondary text-sm">
                Looking for your plan’s allowance rather than the platform’s token counts?
              </p>
              <Link
                to={ROUTES.settingsBillingUsage}
                className="text-accent focus-visible:ring-accent inline-flex w-fit items-center gap-1.5 rounded-md text-sm outline-none focus-visible:ring-2"
              >
                Billing usage and allowance
                <ArrowRight size={15} strokeWidth={1.5} aria-hidden />
              </Link>
            </QCard>
          ) : null}
        </>
      )}
    </div>
  );
}
