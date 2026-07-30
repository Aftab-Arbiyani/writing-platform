import { Tabs } from 'antd';
import { useState, type ReactElement } from 'react';
import { useSearchParams } from 'react-router';

import { DataTable } from '@/components/data-table';
import { LoadingState } from '@/components/loading-state';
import { PageContainer } from '@/components/page-container';
import { PageHeader } from '@/components/page-header';
import { useAdminTable } from '@/hooks/use-admin-table';
import { getErrorMessage } from '@/lib/errors';
import { usePageTitle } from '@/hooks/use-page-title';

import { downloadAuditExport } from '../api/audit.api';
import { AUDIT_FILTER_KEYS, DEFAULT_AUDIT_SORT } from '../audit.constants';
import { AuditDetailDrawer } from '../components/audit-detail-drawer';
import { AuditFilters } from '../components/audit-filters';
import { AuditStatistics } from '../components/audit-statistics';
import { AuditTimeline } from '../components/audit-timeline';
import { AuditToolbar } from '../components/audit-toolbar';
import { buildAuditColumns } from '../components/audit-columns';
import { useAuditLogs } from '../hooks/use-audit';
import { useAuditPrefs } from '../stores/audit-prefs.store';
import type { AuditLog, AuditListParams } from '../types/audit.types';

type Tab = 'log' | 'timeline' | 'statistics';

/**
 * Audit Logs (A6). Three URL tabs — Log (table), Timeline (chronological), and
 * Statistics. Log + Timeline share the URL filter params + one `useAuditLogs`
 * query (parallel with statistics). Admin-only route.
 */
export function AuditPage(): ReactElement {
  usePageTitle('Audit logs');
  const [searchParams, setSearchParams] = useSearchParams();
  const raw = searchParams.get('tab');
  const tab: Tab = raw === 'timeline' || raw === 'statistics' ? raw : 'log';

  const table = useAdminTable(AUDIT_FILTER_KEYS, 20);
  const prefs = useAuditPrefs();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const sort = table.filters.values.sort ?? DEFAULT_AUDIT_SORT;
  const params: AuditListParams = {
    page: table.pagination.page,
    limit: table.pagination.limit,
    ...table.filters.values,
  };
  const query = useAuditLogs(params);

  const setTab = (key: string): void => {
    const next = new URLSearchParams(searchParams);
    if (key === 'log') {
      next.delete('tab');
    } else {
      next.set('tab', key);
    }
    setSearchParams(next, { replace: true });
  };

  const columns = buildAuditColumns({
    hiddenColumns: prefs.hiddenColumns,
    sort,
    onView: (entry: AuditLog) => setDrawerId(entry.id),
  });

  const onSortChange = (key: string | undefined, order: 'asc' | 'desc' | undefined): void => {
    table.filters.setFilter(
      'sort',
      order === undefined || key === undefined ? undefined : order === 'desc' ? `-${key}` : key,
    );
  };

  const onExport = (format: 'csv' | 'json'): void => {
    setExporting(true);
    downloadAuditExport(params, format).finally(() => setExporting(false));
  };

  const isFiltered = AUDIT_FILTER_KEYS.some(
    (key) => key !== 'sort' && table.filters.values[key] !== undefined,
  );
  const items = query.data?.items ?? [];

  return (
    <PageContainer>
      <PageHeader title="Audit logs" description="A record of every privileged action." />
      <Tabs
        activeKey={tab}
        onChange={setTab}
        items={[
          { key: 'log', label: 'Log' },
          { key: 'timeline', label: 'Timeline' },
          { key: 'statistics', label: 'Statistics' },
        ]}
      />

      {tab === 'statistics' ? (
        <AuditStatistics />
      ) : (
        <div className="flex flex-col gap-4">
          <AuditToolbar
            search={table.filters.values.q ?? ''}
            onSearchChange={(value) => table.filters.setFilter('q', value || undefined)}
            filtersOpen={filtersOpen}
            onToggleFilters={() => setFiltersOpen((open) => !open)}
            onRefresh={() => void query.refetch()}
            isFetching={query.isFetching}
            onExport={onExport}
            exporting={exporting}
          />
          {filtersOpen ? <AuditFilters filters={table.filters} /> : null}

          {tab === 'timeline' ? (
            query.isLoading ? (
              <LoadingState variant="rows" rows={8} />
            ) : query.isError ? (
              <p className="text-sm text-danger">{getErrorMessage(query.error)}</p>
            ) : (
              <AuditTimeline entries={items} onView={(entry) => setDrawerId(entry.id)} />
            )
          ) : (
            <DataTable<AuditLog>
              columns={columns}
              data={items}
              rowKey="id"
              loading={query.isLoading}
              error={query.error}
              onRetry={() => void query.refetch()}
              emptyTitle={isFiltered ? 'No audit events match these filters' : 'No audit events'}
              emptyDescription={isFiltered ? 'Try clearing a filter.' : undefined}
              page={table.pagination.page}
              limit={table.pagination.limit}
              total={query.data?.pagination?.total ?? 0}
              onPageChange={table.pagination.setPage}
              onLimitChange={table.pagination.setLimit}
              density={prefs.density}
              onSortChange={onSortChange}
            />
          )}
        </div>
      )}

      <AuditDetailDrawer id={drawerId} onClose={() => setDrawerId(null)} />
    </PageContainer>
  );
}
