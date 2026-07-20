import { QCard } from '@qalam/ui';
import { Table, type TableColumnsType } from 'antd';
import type { ReactElement } from 'react';

import type { RetentionRule } from '../types/security.types';

/**
 * The data-retention registry as a table (category → retention window → legal/technical basis).
 * Shared by the Compliance and Privacy dashboards — both read the same
 * `GET /admin/compliance/retention` registry, so the presentation lives here once.
 */
const RETENTION_COLUMNS: TableColumnsType<RetentionRule> = [
  {
    title: 'Category',
    dataIndex: 'category',
    key: 'category',
    render: (category: string) => <span className="font-mono text-sm text-ink">{category}</span>,
  },
  { title: 'Retention', dataIndex: 'retention', key: 'retention' },
  { title: 'Basis', dataIndex: 'basis', key: 'basis' },
];

export interface RetentionTableProps {
  rules: RetentionRule[];
  title?: string;
}

export function RetentionTable({
  rules,
  title = 'Retention registry',
}: RetentionTableProps): ReactElement {
  return (
    <QCard as="section" padding="lg" className="flex flex-col gap-4">
      <h2 className="text-base font-semibold text-ink">{title}</h2>
      <Table<RetentionRule>
        columns={RETENTION_COLUMNS}
        dataSource={rules}
        rowKey="category"
        pagination={false}
        size="middle"
        sticky
        scroll={{ x: 'max-content' }}
      />
    </QCard>
  );
}
