import { QCard, QSectionHeader } from '@qalam/ui';
import { Banknote, CalendarRange, Receipt, Undo2 } from 'lucide-react';
import type { ReactElement } from 'react';

import { EmptyState } from '@/components/empty-state';
import { PageContainer } from '@/components/page-container';
import { PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import { usePageTitle } from '@/hooks/use-page-title';

import { AsyncSection } from '@/components/async-section';
import { EMPTY_COPY, revenueIsEmpty } from '../lib/analytics-emptiness';
import { formatMinorUnits } from '../lib/money-format';
import { useRevenueAnalytics } from '../hooks/use-monetization';

/**
 * Revenue dashboard (A1c) — read-only, following the P7.4 operations idiom (page header, stat grid,
 * `AsyncSection` per query, honest empty state).
 *
 * **The empty state is the point.** These figures are computed on read from the payments ledger, so an
 * install with no payments returns a complete response full of zeroes. Rendering `0` as a measurement
 * is the W7c defect — an operator cannot distinguish it from a real collapse in revenue — so a zero
 * payment COUNT switches the whole page to saying there is no data.
 *
 * **The per-currency breakdown leads, and the cross-currency scalars follow it** (B8, closing A1-6).
 * `byCurrency` is grouped, so each figure is money in one unit and is printed as money — with its
 * symbol, and with the right number of decimal places for that currency, which is not always two.
 * The four scalars still sum across currencies, so they keep no symbol and keep saying "minor
 * units": on a mixed install they add unlike things, and a `$` on that would assert something false.
 * They are not dropped, because on the single-currency install most deployments are they are the
 * headline, and because they are a shipped shape.
 */
export function RevenueDashboardPage(): ReactElement {
  usePageTitle('Revenue');
  const query = useRevenueAnalytics();
  const revenue = query.data;

  return (
    <PageContainer>
      <PageHeader
        title="Revenue"
        description="Totalled from succeeded payments. Amounts are in minor currency units, summed across all currencies."
      />

      <AsyncSection
        isLoading={query.isLoading}
        error={query.error}
        onRetry={() => void query.refetch()}
        loadingRows={4}
      >
        {revenue ? (
          revenueIsEmpty(revenue) ? (
            <EmptyState
              icon={Banknote}
              title={EMPTY_COPY.revenue.title}
              description={EMPTY_COPY.revenue.description}
              minHeight={260}
            />
          ) : (
            <div className="flex flex-col gap-6">
              <QCard as="section" padding="lg" className="flex flex-col gap-4">
                <QSectionHeader
                  title="By currency"
                  description="Grouped server-side, so each figure is money in one unit."
                />
                {revenue.byCurrency.length === 0 ? (
                  // Reachable only if every payment row is neither succeeded nor refunded — the
                  // scalars would be zero too, so say what is true rather than render a blank table.
                  <p className="text-sm text-ink-muted">
                    No succeeded or refunded payments to group.
                  </p>
                ) : (
                  <ul className="flex flex-col divide-y divide-line">
                    {revenue.byCurrency.map((row) => (
                      <li key={row.currency} className="flex flex-col gap-1 py-3">
                        <span className="flex flex-wrap items-baseline justify-between gap-x-4">
                          <span className="font-mono text-xs uppercase text-ink-secondary">
                            {row.currency}
                          </span>
                          <span className="text-lg font-semibold text-ink [font-variant-numeric:tabular-nums]">
                            {formatMinorUnits(row.totalRevenue, row.currency)}
                          </span>
                        </span>
                        <span className="text-xs text-ink-muted [font-variant-numeric:tabular-nums]">
                          last 30 days {formatMinorUnits(row.last30dRevenue, row.currency)} &middot;
                          refunded {formatMinorUnits(row.refunded, row.currency)} &middot;{' '}
                          {row.paymentsCount.toLocaleString()} payment
                          {row.paymentsCount === 1 ? '' : 's'}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </QCard>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard
                  label="Total revenue"
                  value={revenue.totalRevenue.toLocaleString()}
                  icon={Banknote}
                  hint="All succeeded payments, minor units"
                />
                <StatCard
                  label="Last 30 days"
                  value={revenue.last30dRevenue.toLocaleString()}
                  icon={CalendarRange}
                  hint="Succeeded payments in the window"
                />
                <StatCard
                  label="Refunded"
                  value={revenue.refunded.toLocaleString()}
                  icon={Undo2}
                  hint="Total refunded, minor units"
                />
                <StatCard
                  label="Payments"
                  value={revenue.paymentsCount.toLocaleString()}
                  icon={Receipt}
                  hint="Count of succeeded payments"
                />
              </div>

              <QCard as="section" padding="lg" className="flex flex-col gap-2">
                <QSectionHeader title="Reading these figures" />
                <p className="text-sm text-ink-secondary">
                  Refunds are reported separately and are <strong>not</strong> deducted from total
                  revenue &mdash; the two sums come from different payment statuses, so net revenue
                  is total minus refunded.
                </p>
                <p className="text-sm text-ink-secondary">
                  The four totals above are summed across every currency, so on a multi-currency
                  install they add unlike units &mdash; that is why they carry no symbol. Use the
                  per-currency breakdown for a figure you can quote.
                </p>
              </QCard>
            </div>
          )
        ) : null}
      </AsyncSection>
    </PageContainer>
  );
}
