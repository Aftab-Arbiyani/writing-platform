import { QCard, QSectionHeader } from '@qalam/ui';
import { Banknote, CalendarRange, Receipt, Undo2 } from 'lucide-react';
import type { ReactElement } from 'react';

import { EmptyState } from '@/components/empty-state';
import { PageContainer } from '@/components/page-container';
import { PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import { usePageTitle } from '@/hooks/use-page-title';

import { AsyncSection } from '../components/async-section';
import { EMPTY_COPY, revenueIsEmpty } from '../lib/analytics-emptiness';
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
 * **Amounts are labelled as minor units and carry no currency symbol**, deliberately.
 * `MonetizationAnalyticsService.sumPayments` sums `p.amount` across every currency without grouping,
 * so on a multi-currency install the total is an arithmetic sum of unlike things. Printing `$` on that
 * would assert something false; the label states the unit and the caveat is in the description
 * (docs/48 §3, A1-6).
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
                  If this install takes payments in more than one currency, these totals add unlike
                  units together and only the payment count is meaningful.
                </p>
              </QCard>
            </div>
          )
        ) : null}
      </AsyncSection>
    </PageContainer>
  );
}
