import { QCard } from '@qalam/ui';
import { Table, type TableColumnsType } from 'antd';
import { Gauge, TrendingUp, Waypoints } from 'lucide-react';
import type { ReactElement } from 'react';

import { EnvBadge } from '@/components/env-badge';
import { PageContainer } from '@/components/page-container';
import { PageHeader } from '@/components/page-header';
import { usePageTitle } from '@/hooks/use-page-title';
import { formatCount, formatPercent } from '@/lib/format';

import { AsyncSection } from '@/components/async-section';
import { BoolIndicator } from '../components/bool-indicator';
import { DefinitionCard } from '../components/definition-card';
import { useObservability, useOperationsMetrics } from '../hooks/use-operations';
import type { MetricSeries } from '../types/operations.types';

const METRIC_COLUMNS: TableColumnsType<MetricSeries> = [
  {
    title: 'Metric',
    dataIndex: 'name',
    key: 'name',
    render: (name: string) => <span className="font-mono text-sm text-ink">{name}</span>,
  },
  {
    title: 'Value',
    dataIndex: 'value',
    key: 'value',
    align: 'right',
    className: 'tabular-nums',
    render: (value: number | null) => (value === null ? '—' : formatCount(value)),
  },
  { title: 'Unit', dataIndex: 'unit', key: 'unit' },
  {
    title: 'Source',
    dataIndex: 'source',
    key: 'source',
    render: (source: string) => <span className="font-mono text-sm text-ink">{source}</span>,
  },
];

/**
 * Metrics Viewer (P7.4) — the exposed Prometheus metric registry as a series table, above the
 * observability posture (metrics exposition + tracing). Read-only, admin-gated, auto-refreshing so
 * live counters move without a manual reload.
 */
export function MetricsViewerPage(): ReactElement {
  usePageTitle('Metrics');
  const metricsQuery = useOperationsMetrics();
  const observabilityQuery = useObservability();

  const metrics = metricsQuery.data;
  const observability = observabilityQuery.data;

  return (
    <PageContainer>
      <PageHeader
        title="Metrics"
        description="The exposed metric registry and the platform's observability posture."
        actions={<EnvBadge />}
      />

      {/* Observability posture. */}
      <AsyncSection
        isLoading={observabilityQuery.isLoading}
        error={observabilityQuery.error}
        onRetry={() => void observabilityQuery.refetch()}
        loadingRows={4}
      >
        {observability ? (
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <DefinitionCard
              title="Metrics exposition"
              icon={Gauge}
              items={[
                {
                  label: 'Exposed',
                  value: (
                    <BoolIndicator
                      value={observability.metrics.exposed}
                      trueLabel="Exposed"
                      falseLabel="Off"
                    />
                  ),
                },
                {
                  label: 'Endpoint',
                  value: (
                    <span className="font-mono text-sm text-ink">
                      {observability.metrics.endpoint || '—'}
                    </span>
                  ),
                },
                { label: 'Series', value: formatCount(observability.metrics.series) },
              ]}
            />
            <DefinitionCard
              title="Tracing"
              icon={Waypoints}
              items={[
                {
                  label: 'Enabled',
                  value: (
                    <BoolIndicator
                      value={observability.tracing.enabled}
                      trueLabel="Enabled"
                      falseLabel="Disabled"
                    />
                  ),
                },
                { label: 'Sample rate', value: formatPercent(observability.tracing.sampleRate) },
                {
                  label: 'Traces retained',
                  value: formatCount(observability.tracing.tracesRetained),
                },
                {
                  label: 'Spans retained',
                  value: formatCount(observability.tracing.spansRetained),
                },
              ]}
            />
          </div>
        ) : null}
      </AsyncSection>

      {/* Metric registry series. */}
      <QCard as="section" padding="lg" className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <TrendingUp size={18} strokeWidth={1.75} className="text-ink-secondary" aria-hidden />
            <h2 className="text-base font-semibold text-ink">Metric registry</h2>
          </div>
          {metrics ? (
            <p className="text-sm text-ink-secondary">
              {metrics.registry} · {metrics.exposition} exposition
            </p>
          ) : null}
        </div>
        <AsyncSection
          isLoading={metricsQuery.isLoading}
          error={metricsQuery.error}
          onRetry={() => void metricsQuery.refetch()}
          loadingRows={6}
        >
          {metrics ? (
            <Table<MetricSeries>
              columns={METRIC_COLUMNS}
              dataSource={metrics.series}
              rowKey="name"
              pagination={false}
              size="middle"
              sticky
              scroll={{ x: 'max-content' }}
              locale={{ emptyText: 'No metric series exposed.' }}
            />
          ) : null}
        </AsyncSection>
      </QCard>
    </PageContainer>
  );
}
