import { useToast } from '@qalam/ui';
import { useState, type ReactElement } from 'react';

import { DataTable } from '@/components/data-table';
import { useAdminTable } from '@/hooks/use-admin-table';
import { getErrorMessage } from '@/lib/errors';

import { useEscalateReport } from '../hooks/use-moderation-mutations';
import { useReports } from '../hooks/use-reports';
import { DEFAULT_REPORT_SORT, REPORT_FILTER_KEYS } from '../moderation.constants';
import { useModerationPrefs } from '../stores/moderation-prefs.store';
import type { Report, ReportListParams } from '../types/moderation.types';
import { AssignDialog } from './assign-dialog';
import { DecisionDialog } from './decision-dialog';
import { buildReportColumns } from './report-columns';
import { ReportBulkBar } from './report-bulk-bar';
import { ReportDetailDrawer } from './report-detail-drawer';
import { ReportsFilters } from './reports-filters';
import { ReportsToolbar } from './reports-toolbar';

/** The Report Queue tab — table + toolbar + filters + bulk + detail drawer + decision/assign dialogs. */
export function ReportsView(): ReactElement {
  const table = useAdminTable(REPORT_FILTER_KEYS, 20);
  const prefs = useModerationPrefs();
  const toast = useToast();
  const escalate = useEscalateReport();

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [resolveReport, setResolveReport] = useState<Report | null>(null);
  const [assignReport, setAssignReport] = useState<Report | null>(null);

  const sort = table.filters.values.sort ?? DEFAULT_REPORT_SORT;
  const params: ReportListParams = {
    page: table.pagination.page,
    limit: table.pagination.limit,
    ...table.filters.values,
  };
  const query = useReports(params);

  const onEscalate = (report: Report): void => {
    escalate.mutate(
      { id: report.id },
      {
        onSuccess: () => toast.success('Report escalated.'),
        onError: (error) => toast.error(getErrorMessage(error)),
      },
    );
  };

  const columns = buildReportColumns({
    hiddenColumns: prefs.hiddenColumns,
    sort,
    onView: (report) => setDrawerId(report.id),
    onAssign: setAssignReport,
    onEscalate,
    onResolve: setResolveReport,
  });

  const onSortChange = (key: string | undefined, order: 'asc' | 'desc' | undefined): void => {
    table.filters.setFilter(
      'sort',
      order === undefined || key === undefined ? undefined : order === 'desc' ? `-${key}` : key,
    );
  };

  const isFiltered = REPORT_FILTER_KEYS.some(
    (key) => key !== 'sort' && table.filters.values[key] !== undefined,
  );

  return (
    <div className="flex flex-col gap-4">
      <ReportsToolbar
        search={table.filters.values.q ?? ''}
        onSearchChange={(value) => table.filters.setFilter('q', value || undefined)}
        filtersOpen={filtersOpen}
        onToggleFilters={() => setFiltersOpen((open) => !open)}
        onRefresh={() => void query.refetch()}
        isFetching={query.isFetching}
      />
      {filtersOpen ? <ReportsFilters filters={table.filters} /> : null}
      <ReportBulkBar selection={table.selection} />
      <DataTable<Report>
        columns={columns}
        data={query.data?.items ?? []}
        rowKey="id"
        loading={query.isLoading}
        error={query.error}
        onRetry={() => void query.refetch()}
        emptyTitle={isFiltered ? 'No reports match these filters' : 'No reports'}
        emptyDescription={isFiltered ? 'Try clearing a filter.' : 'The moderation queue is clear.'}
        page={table.pagination.page}
        limit={table.pagination.limit}
        total={query.data?.pagination?.total ?? 0}
        onPageChange={table.pagination.setPage}
        onLimitChange={table.pagination.setLimit}
        selection={table.selection}
        density={prefs.density}
        onSortChange={onSortChange}
      />

      <ReportDetailDrawer
        reportId={drawerId}
        onClose={() => setDrawerId(null)}
        onResolve={setResolveReport}
        onAssign={setAssignReport}
      />
      <DecisionDialog report={resolveReport} onClose={() => setResolveReport(null)} />
      <AssignDialog report={assignReport} onClose={() => setAssignReport(null)} />
    </div>
  );
}
