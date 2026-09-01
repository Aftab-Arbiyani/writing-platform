import { QCard, QSectionHeader } from '@qalam/ui';
import { Table, type TableColumnsType } from 'antd';
import { CalendarRange, CircleDollarSign, Coins, Cpu } from 'lucide-react';
import type { ReactElement } from 'react';

import { EmptyState } from '@/components/empty-state';
import { PageContainer } from '@/components/page-container';
import { PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import { usePageTitle } from '@/hooks/use-page-title';
import { formatUsd } from '@/lib/format';

import { AsyncSection } from '@/components/async-section';
import { EMPTY_COPY, usageIsEmpty } from '../lib/analytics-emptiness';
import { useUsageAnalytics } from '../hooks/use-monetization';

/**
 * AI usage & cost dashboard (A1c) — tokens, credits consumed, provider cost, and the per-feature
 * breakdown.
 *
 * The only one of the three whose money figures are unambiguous: `cost_usd` is stored in USD on the
 * credit ledger, so `formatUsd` is honest here in a way it would not be on the revenue page.
 *
 * Emptiness needs both signals. `byFeature` is a GROUP BY that excludes null features, and a provider
 * that reported no token counts would still produce feature rows worth showing — so the page is only
 * "empty" when there are no rows AND no tokens.
 */
type FeatureRow = { feature: string; tokens: number; costUsd: number };

const FEATURE_COLUMNS: TableColumnsType<FeatureRow> = [
  {
    title: 'Feature',
    dataIndex: 'feature',
    key: 'feature',
    render: (feature: string) => <span className="font-mono text-sm text-ink">{feature}</span>,
  },
  {
    title: 'Tokens',
    dataIndex: 'tokens',
    key: 'tokens',
    align: 'right',
    className: 'tabular-nums',
    defaultSortOrder: 'descend',
    sorter: (a, b) => a.tokens - b.tokens,
    render: (tokens: number) => tokens.toLocaleString(),
  },
  {
    title: 'Cost',
    dataIndex: 'costUsd',
    key: 'costUsd',
    align: 'right',
    className: 'tabular-nums',
    sorter: (a, b) => a.costUsd - b.costUsd,
    render: (costUsd: number) => formatUsd(costUsd),
  },
];

export function UsageDashboardPage(): ReactElement {
  usePageTitle('AI usage & cost');
  const query = useUsageAnalytics();
  const usage = query.data;

  return (
    <PageContainer>
      <PageHeader
        title="AI usage & cost"
        description="Totalled from the credit ledger's AI-usage entries, attributed per feature."
      />

      <AsyncSection
        isLoading={query.isLoading}
        error={query.error}
        onRetry={() => void query.refetch()}
        loadingRows={5}
      >
        {usage ? (
          usageIsEmpty(usage) ? (
            <EmptyState
              icon={Cpu}
              title={EMPTY_COPY.usage.title}
              description={EMPTY_COPY.usage.description}
              minHeight={260}
            />
          ) : (
            <div className="flex flex-col gap-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard
                  label="Total tokens"
                  value={usage.totalTokens.toLocaleString()}
                  icon={Cpu}
                  hint="Input + output across all features"
                />
                <StatCard
                  label="Credits consumed"
                  value={usage.totalCreditsConsumed.toLocaleString()}
                  icon={Coins}
                  hint="Debited from user wallets"
                />
                <StatCard
                  label="Total cost"
                  value={formatUsd(usage.totalCostUsd)}
                  icon={CircleDollarSign}
                  hint="Provider cost, all time"
                />
                <StatCard
                  label="Last 30 days"
                  value={formatUsd(usage.last30dCostUsd)}
                  icon={CalendarRange}
                  hint="Provider cost in the window"
                />
              </div>

              <QCard as="section" padding="lg" className="flex flex-col gap-4">
                <QSectionHeader
                  title="By feature"
                  description="Only requests attributed to a feature appear here."
                />
                <Table<FeatureRow>
                  columns={FEATURE_COLUMNS}
                  dataSource={usage.byFeature}
                  rowKey={(row) => row.feature}
                  pagination={false}
                  size="middle"
                  sticky
                  scroll={{ x: 'max-content' }}
                  locale={{ emptyText: 'No feature-attributed usage recorded.' }}
                />
              </QCard>
            </div>
          )
        ) : null}
      </AsyncSection>
    </PageContainer>
  );
}
