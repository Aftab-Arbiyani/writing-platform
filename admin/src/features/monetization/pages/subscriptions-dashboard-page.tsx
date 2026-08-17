import { QCard, QSectionHeader } from '@qalam/ui';
import {
  ArrowDownRight,
  ArrowUpRight,
  CircleSlash,
  Repeat,
  Sparkles,
  UserPlus,
} from 'lucide-react';
import { useState, type ReactElement } from 'react';

import { EmptyState } from '@/components/empty-state';
import { PageContainer } from '@/components/page-container';
import { PageHeader } from '@/components/page-header';
import { SearchInput } from '@/components/search-input';
import { StatCard } from '@/components/stat-card';
import { usePageTitle } from '@/hooks/use-page-title';

import { AccountSubscription } from '../components/account-subscription';
import { AsyncSection } from '../components/async-section';
import { EMPTY_COPY, subscriptionsAreEmpty } from '../lib/analytics-emptiness';
import { useSubscriptionAnalytics, useUserSubscription } from '../hooks/use-monetization';

/**
 * Subscriptions dashboard (A1c) — status and tier distribution, 30-day lifecycle movement, and a
 * lookup for one account (B8, closing A1-7).
 *
 * **The aggregates and the single account answer different questions and both belong here.** A1
 * shipped the aggregates and named the missing half on the page, because `GET /monetization/
 * subscription` is `@CurrentUser` self-scoped and no admin equivalent existed. It does now, so the
 * page carries the lookup rather than a sentence about not having one.
 *
 * Emptiness is decided by `byStatus` having no keys, not by `activeCount` being zero: an install whose
 * only subscriptions are cancelled has real data and no active ones, and flattening that to "no data"
 * would hide a churn event worth seeing. The lookup is deliberately OUTSIDE that check — an install
 * with no subscriptions at all still has accounts an operator may want to confirm are on free.
 */
export function SubscriptionsDashboardPage(): ReactElement {
  usePageTitle('Subscriptions');
  const query = useSubscriptionAnalytics();
  const subs = query.data;
  const [userId, setUserId] = useState('');
  const account = useUserSubscription(userId.trim());

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
            </div>
          )
        ) : null}
      </AsyncSection>

      <QCard as="section" padding="lg" className="flex flex-col gap-3">
        <QSectionHeader
          title="Look up one account"
          description="Paste the user's ID to see their subscription. Entitlement overrides live on the Entitlements screen."
        />
        <div className="max-w-md">
          <SearchInput
            value={userId}
            onChange={setUserId}
            placeholder="User ID (UUID)"
            ariaLabel="User ID"
          />
        </div>

        {userId.trim() === '' ? null : (
          <AsyncSection
            isLoading={account.isLoading}
            error={account.error}
            onRetry={() => void account.refetch()}
            loadingRows={4}
          >
            {account.data === undefined ? null : <AccountSubscription result={account.data} />}
          </AsyncSection>
        )}
      </QCard>
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
