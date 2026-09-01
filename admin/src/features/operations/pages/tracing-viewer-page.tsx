import { QCard } from '@qalam/ui';
import { Table, type TableColumnsType } from 'antd';
import { Waypoints } from 'lucide-react';
import type { ReactElement } from 'react';

import { EnvBadge } from '@/components/env-badge';
import { PageContainer } from '@/components/page-container';
import { PageHeader } from '@/components/page-header';
import { usePageTitle } from '@/hooks/use-page-title';
import { formatCount, formatDateTime, formatMs } from '@/lib/format';

import { AsyncSection } from '@/components/async-section';
import { TraceStatusBadge } from '../components/operations-badges';
import { useTraces } from '../hooks/use-operations';
import type { Trace, TraceSpan } from '../types/operations.types';

const SPAN_COLUMNS: TableColumnsType<TraceSpan> = [
  {
    title: 'Span',
    dataIndex: 'name',
    key: 'name',
    render: (name: string) => <span className="text-ink">{name}</span>,
  },
  { title: 'Kind', dataIndex: 'kind', key: 'kind' },
  {
    title: 'Status',
    dataIndex: 'status',
    key: 'status',
    render: (status: string) => <span className="font-mono text-sm text-ink">{status}</span>,
  },
  {
    title: 'Duration',
    dataIndex: 'durationMs',
    key: 'durationMs',
    align: 'right',
    className: 'tabular-nums',
    render: (durationMs: number) => formatMs(durationMs),
  },
  {
    title: 'Started',
    dataIndex: 'startedAt',
    key: 'startedAt',
    render: (startedAt: string) => formatDateTime(startedAt),
  },
];

function SpanTable({ trace }: { trace: Trace }): ReactElement {
  return (
    <Table<TraceSpan>
      columns={SPAN_COLUMNS}
      dataSource={trace.spans}
      rowKey="spanId"
      pagination={false}
      size="small"
      scroll={{ x: 'max-content' }}
      locale={{ emptyText: 'No spans recorded for this trace.' }}
    />
  );
}

const TRACE_COLUMNS: TableColumnsType<Trace> = [
  {
    title: 'Trace ID',
    dataIndex: 'traceId',
    key: 'traceId',
    render: (traceId: string) => <span className="font-mono text-sm text-ink">{traceId}</span>,
  },
  {
    title: 'Root operation',
    dataIndex: 'rootName',
    key: 'rootName',
    render: (rootName: string) => <span className="font-medium text-ink">{rootName}</span>,
  },
  {
    title: 'Status',
    dataIndex: 'status',
    key: 'status',
    render: (_, trace) => <TraceStatusBadge status={trace.status} />,
  },
  {
    title: 'Spans',
    dataIndex: 'spanCount',
    key: 'spanCount',
    align: 'right',
    className: 'tabular-nums',
    render: (spanCount: number) => formatCount(spanCount),
  },
  {
    title: 'Duration',
    dataIndex: 'durationMs',
    key: 'durationMs',
    align: 'right',
    className: 'tabular-nums',
    render: (durationMs: number) => formatMs(durationMs),
  },
  {
    title: 'Started',
    dataIndex: 'startedAt',
    key: 'startedAt',
    render: (startedAt: string) => formatDateTime(startedAt),
  },
];

/**
 * Tracing Viewer (P7.4) — the recent distributed traces. Read-only, admin-gated. Each trace row
 * expands to its span table (name / kind / status / duration), so an operator can drill from a slow
 * or errored request down to the span that caused it without leaving the console.
 */
export function TracingViewerPage(): ReactElement {
  usePageTitle('Tracing');
  const query = useTraces();

  return (
    <PageContainer>
      <PageHeader
        title="Tracing"
        description="Recent distributed traces — expand a trace to inspect its spans."
        actions={<EnvBadge />}
      />

      <QCard as="section" padding="lg" className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Waypoints size={18} strokeWidth={1.75} className="text-ink-secondary" aria-hidden />
          <h2 className="text-base font-semibold text-ink">Recent traces</h2>
        </div>
        <AsyncSection
          isLoading={query.isLoading}
          error={query.error}
          onRetry={() => void query.refetch()}
          loadingRows={6}
        >
          <Table<Trace>
            columns={TRACE_COLUMNS}
            dataSource={query.data ?? []}
            rowKey="traceId"
            pagination={false}
            size="middle"
            sticky
            scroll={{ x: 'max-content' }}
            expandable={{
              expandedRowRender: (trace) => <SpanTable trace={trace} />,
              rowExpandable: (trace) => trace.spans.length > 0,
            }}
            locale={{ emptyText: 'No traces recorded.' }}
          />
        </AsyncSection>
      </QCard>
    </PageContainer>
  );
}
