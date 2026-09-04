import { QCard, QEmptyState, QSpinner } from '@qalam/ui';
import { Gauge } from 'lucide-react';
import type { ReactElement } from 'react';

import { ApiError } from '@/lib/api-client';
import { messageFor } from '@/lib/error-messages';
import { usePageTitle } from '@/hooks/use-page-title';

import { FeatureAllowanceCard } from '../components/feature-allowance-card';
import { useMonetizationUsage } from '../hooks/use-usage';
import { normalizeAllowances } from '../lib/feature-allowances';
import { isMonetizationEnabled } from '../lib/monetization-enabled';

/**
 * Usage (`/settings/billing/usage`) — what the writer has used of each tool.
 *
 * Read-only: the server owns these counts, written as each request completes. This is the surface
 * that makes metering visible, which is what makes an allowance feel like a budget rather than a
 * surprise.
 *
 * **D5 rewrote what this page is about.** It used to show three token windows, a projected monthly
 * cost in dollars, and a per-feature token breakdown — plus a cross-link to a second page showing
 * the AI platform's own token ledger, because the two overlapped enough that a reader comparing them
 * had to be told which was which. All of that measured the operator's cost, not the writer's use.
 * A writer needs one number per tool: how many of today's Polish actions are left. Tokens and cost
 * still exist and still matter — to an operator, on the admin dashboards, where they belong.
 */
export function UsagePage(): ReactElement {
  usePageTitle('Usage');
  const enabled = isMonetizationEnabled();
  const usage = useMonetizationUsage();

  if (!enabled) {
    return (
      <QEmptyState
        icon={Gauge}
        title="Usage isn’t available yet"
        description="Tool allowances arrive with subscriptions."
      />
    );
  }

  const allowances = normalizeAllowances(usage.data?.quotas);

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h2 className="text-ink mb-1 font-serif text-xl font-semibold">Usage</h2>
        <p className="text-ink-secondary text-sm">
          What you’ve used of each writing tool, and how much is left.
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
      ) : allowances.length > 0 ? (
        <ul aria-label="Tool allowances" className="grid gap-4 md:grid-cols-3">
          {allowances.map((allowance) => (
            <FeatureAllowanceCard key={allowance.key} allowance={allowance} />
          ))}
        </ul>
      ) : (
        /*
         * Empty is legitimate, not an error. The server reports no allowances when the plan grants
         * every tool without limit — the enterprise case — and a page that said "0 of 0" there would
         * invent a wall that does not exist.
         */
        <p className="text-ink-muted text-sm">Your plan doesn’t limit any of the writing tools.</p>
      )}
    </div>
  );
}
