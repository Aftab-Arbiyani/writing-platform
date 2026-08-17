import { QCard, QSectionHeader } from '@qalam/ui';
import {
  ArrowDownRight,
  ArrowUpRight,
  CircleSlash,
  Repeat,
  Sparkles,
  UserPlus,
} from 'lucide-react';
import type { ReactElement } from 'react';

import { EmptyState } from '@/components/empty-state';
import { PageContainer } from '@/components/page-container';
import { PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import { usePageTitle } from '@/hooks/use-page-title';

import { AsyncSection } from '../components/async-section';
import { EMPTY_COPY, subscriptionsAreEmpty } from '../lib/analytics-emptiness';
import { useSubscriptionAnalytics } from '../hooks/use-monetization';

/**
 * Subscriptions dashboard (A1c) — status and tier distribution plus 30-day lifecycle movement.
 *
 * **Aggregate only, and the page says so.** There is no admin route that returns an individual
 * account's subscription — `GET /monetization/subscription` is `@CurrentUser` self-scoped — so an
 * operator cannot look one up from here or anywhere else in this app. That is a real gap in the row's
 * stated goal ("an operator cannot see a subscription") and it is named on the page rather than left
 * for someone to discover by looking for a search box that does not exist (docs/48 §3, A1-7).
 *
 * Emptiness is decided by `byStatus` having no keys, not by `activeCount` being zero: an install whose
 * only subscriptions are cancelled has real data and no active ones, and flattening that to "no data"
 * would hide a churn event worth seeing.
 */
export function SubscriptionsDashboardPage(): ReactElement {
  usePageTitle('Subscriptions');
  const query = useSubscriptionAnalytics();
  const subs = query.data;

  return (
    <PageContainer>
      <PageHeader
        title="Subscriptions"
        description="Distribution by status and tier, with the last 30 days of lifecycle movement."
      />

      <AsyncSection
        isLoading={query.isLoading}
        error={query.error}
        onRetry={() => void query.refetch()}
        loadingRows={5}
      >
        {subs ? (
          subscriptionsAreEmpty(subs) ? (
            <EmptyState
              icon={Repeat}
              title={EMPTY_COPY.subscriptions.title}
              description={EMPTY_COPY.subscriptions.description}
              minHeight={260}
            />
          ) : (
            <div className="flex flex-col gap-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <StatCard
                  label="Active"
                  value={subs.activeCount.toLocaleString()}
                  icon={Repeat}
                  hint="Subscriptions in the active status"
                />
                <StatCard
                  label="Trialing"
                  value={subs.trialingCount.toLocaleString()}
                  icon={Sparkles}
                  hint="Currently inside a free trial"
                />
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <Distribution title="By status" counts={subs.byStatus} />
                <Distribution title="By tier" counts={subs.byTier} />
              </div>

              <QCard as="section" padding="lg" className="flex flex-col gap-4">
                <QSectionHeader
                  title="Last 30 days"
                  description="Counted from subscription events, so a single account may appear in more than one row."
                />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <StatCard
                    label="Created"
                    value={subs.last30d.created.toLocaleString()}
                    icon={UserPlus}
                  />
                  <StatCard
                    label="Upgraded"
                    value={subs.last30d.upgraded.toLocaleString()}
                    icon={ArrowUpRight}
                  />
                  <StatCard
                    label="Downgraded"
                    value={subs.last30d.downgraded.toLocaleString()}
                    icon={ArrowDownRight}
                  />
                  <StatCard
                    label="Cancelled"
                    value={subs.last30d.canceled.toLocaleString()}
                    icon={CircleSlash}
                  />
                </div>
              </QCard>

              <QCard as="section" padding="lg" className="flex flex-col gap-2">
                <QSectionHeader title="Looking up one account" />
                <p className="text-sm text-ink-secondary">
                  This surface is aggregate only. The platform exposes no admin endpoint for an
                  individual subscription, so a single account&rsquo;s plan and status cannot be
                  read here. Its entitlements can &mdash; see Entitlements.
                </p>
              </QCard>
            </div>
          )
        ) : null}
      </AsyncSection>
    </PageContainer>
  );
}

/**
 * A count-per-key breakdown, largest first.
 *
 * Renders its own "nothing here" line rather than an empty list: the parent's emptiness check is about
 * the whole page, and one of the two distributions can legitimately be empty while the other is not.
 */
function Distribution({
  title,
  counts,
}: {
  title: string;
  counts: Record<string, number>;
}): ReactElement {
  const rows = Object.entries(counts).sort(([, a], [, b]) => b - a);
  const total = rows.reduce((sum, [, count]) => sum + count, 0);

  return (
    <QCard as="section" padding="lg" className="flex flex-col gap-3">
      <QSectionHeader title={title} />
      {rows.length === 0 ? (
        <p className="text-sm text-ink-muted">Nothing recorded in this dimension.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line">
          {rows.map(([key, count]) => (
            <li key={key} className="flex items-baseline justify-between gap-4 py-2">
              <span className="font-mono text-sm text-ink">{key}</span>
              <span className="flex items-baseline gap-2">
                <span className="text-sm font-medium text-ink [font-variant-numeric:tabular-nums]">
                  {count.toLocaleString()}
                </span>
                <span className="text-xs text-ink-muted [font-variant-numeric:tabular-nums]">
                  {total === 0 ? '' : `${String(Math.round((count / total) * 100))}%`}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </QCard>
  );
}
