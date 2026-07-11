import { AppealStatus } from '@qalam/shared';
import { Select, Tag, type TableColumnsType } from 'antd';
import { Eye } from 'lucide-react';
import { useState, type ReactElement } from 'react';

import { ActionMenu } from '@/components/action-menu';
import { DataTable } from '@/components/data-table';
import { Toolbar } from '@/components/toolbar';
import { useAdminTable } from '@/hooks/use-admin-table';
import { formatDate } from '@/lib/format';

import { useAppeals } from '../hooks/use-appeals';
import type { Appeal, AppealListParams } from '../types/moderation.types';
import { AppealDetailDrawer } from './appeal-detail-drawer';

const shortId = (id: string): string => id.slice(0, 8);

const STATUS_OPTIONS = [
  { label: 'Pending', value: AppealStatus.Pending },
  { label: 'Approved', value: AppealStatus.Approved },
  { label: 'Rejected', value: AppealStatus.Rejected },
];

/** The Appeal Queue tab — status-filtered table + the appeal detail drawer. */
export function AppealsView(): ReactElement {
  const table = useAdminTable(['status'], 20);
  const [drawerId, setDrawerId] = useState<string | null>(null);

  const params: AppealListParams = {
    page: table.pagination.page,
    limit: table.pagination.limit,
    status: table.filters.values.status,
  };
  const query = useAppeals(params);

  const columns: TableColumnsType<Appeal> = [
    {
      key: 'status',
      title: 'Status',
      dataIndex: 'status',
      render: (value: string) => <Tag>{value}</Tag>,
    },
    { key: 'appellant', title: 'Appellant', dataIndex: 'appellantId', render: shortId },
    { key: 'report', title: 'Report', dataIndex: 'reportId', render: shortId },
    {
      key: 'created',
      title: 'Filed',
      dataIndex: 'createdAt',
      render: (value: string) => formatDate(value),
    },
    {
      key: 'actions',
      title: '',
      fixed: 'right',
      width: 64,
      render: (_, appeal) => (
        <ActionMenu
          ariaLabel={`Actions for appeal ${shortId(appeal.id)}`}
          items={[
            { key: 'view', label: 'View appeal', icon: Eye, onClick: () => setDrawerId(appeal.id) },
          ]}
        />
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <Toolbar
        start={
          <Select
            allowClear
            placeholder="Any status"
            aria-label="Appeal status"
            style={{ minWidth: 180 }}
            value={table.filters.values.status ?? undefined}
            options={STATUS_OPTIONS}
            onChange={(value?: string) => table.filters.setFilter('status', value ?? undefined)}
          />
        }
      />
      <DataTable<Appeal>
        columns={columns}
        data={query.data?.items ?? []}
        rowKey="id"
        loading={query.isLoading}
        error={query.error}
        onRetry={() => void query.refetch()}
        emptyTitle="No appeals"
        emptyDescription="No appeals match this view."
        page={table.pagination.page}
        limit={table.pagination.limit}
        total={query.data?.pagination?.total ?? 0}
        onPageChange={table.pagination.setPage}
        onLimitChange={table.pagination.setLimit}
      />
      <AppealDetailDrawer appealId={drawerId} onClose={() => setDrawerId(null)} />
    </div>
  );
}
