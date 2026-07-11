import { QErrorState } from '@qalam/ui';
import { Table, type TableColumnsType, type TableProps } from 'antd';
import type { Key, ReactElement } from 'react';

import { EmptyState } from '@/components/empty-state';
import { Pagination } from '@/components/pagination';
import type { BulkSelection } from '@/hooks/use-bulk-selection';
import { getErrorMessage, getRequestId } from '@/lib/errors';

/**
 * The admin table (docs/07 §7.5) — wraps AntD `Table` with the house states baked in: an error
 * panel with retry + requestId, a warm `EmptyState`, a sticky header, horizontal scroll on narrow
 * viewports, and OFFSET pagination rendered via the shared `Pagination` (URL-synced by the page).
 * Optional row selection wires straight to `useBulkSelection`. Set `virtual` (+ `scrollY`) for large
 * result sets — AntD's built-in virtualization keeps the DOM light.
 *
 * Numeric columns should set `align:'right'`; give them `className:'tabular-nums'` for aligned digits.
 */
export interface DataTableProps<T> {
  columns: TableColumnsType<T>;
  data: T[];
  rowKey: keyof T | ((record: T) => string);
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
  // Offset pagination (omit to hide the pager, e.g. for a fully-loaded small set).
  page?: number;
  limit?: number;
  total?: number;
  onPageChange?: (page: number) => void;
  onLimitChange?: (limit: number) => void;
  // Row selection for bulk actions.
  selection?: BulkSelection;
  // Density (docs/07 §7.5) — maps to AntD Table `size`; default 'middle'.
  density?: 'small' | 'middle' | 'large';
  // Server-side sort capture: fired when the operator clicks a `sorter` column
  // header. Framework-agnostic (no AntD types leak to callers) — `key` is the
  // clicked column's `key`; `order` is undefined when sorting is cleared.
  onSortChange?: (key: string | undefined, order: 'asc' | 'desc' | undefined) => void;
  // Performance: AntD row virtualization (requires a fixed body height).
  virtual?: boolean;
  scrollX?: number | string;
  scrollY?: number;
}

export function DataTable<T extends object>({
  columns,
  data,
  rowKey,
  loading = false,
  error,
  onRetry,
  emptyTitle = 'Nothing here yet',
  emptyDescription,
  page,
  limit,
  total,
  onPageChange,
  onLimitChange,
  selection,
  density = 'middle',
  onSortChange,
  virtual = false,
  scrollX = 'max-content',
  scrollY,
}: DataTableProps<T>): ReactElement {
  if (error) {
    return (
      <QErrorState
        description={getErrorMessage(error)}
        requestId={getRequestId(error)}
        onRetry={onRetry}
      />
    );
  }

  const rowSelection: TableProps<T>['rowSelection'] = selection
    ? {
        selectedRowKeys: selection.selectedIds,
        onChange: (keys: Key[]) => selection.selectAll(keys.map(String)),
      }
    : undefined;

  const showPager =
    total !== undefined && page !== undefined && limit !== undefined && onPageChange;

  // Translate AntD's sorter event into the framework-agnostic callback. Pagination
  // and column filters are unused (external pager, no column filters), so `onChange`
  // fires only for sort clicks.
  const handleChange: TableProps<T>['onChange'] = (_pagination, _filters, sorter) => {
    if (!onSortChange) {
      return;
    }
    const single = Array.isArray(sorter) ? sorter[0] : sorter;
    const key = single?.columnKey;
    const order = single?.order;
    onSortChange(
      key === undefined ? undefined : String(key),
      order === 'ascend' ? 'asc' : order === 'descend' ? 'desc' : undefined,
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <Table<T>
        columns={columns}
        dataSource={data}
        rowKey={rowKey as TableProps<T>['rowKey']}
        loading={loading}
        rowSelection={rowSelection}
        pagination={false}
        onChange={handleChange}
        sticky
        size={density}
        virtual={virtual}
        scroll={{ x: scrollX, y: scrollY }}
        locale={{
          emptyText: loading ? (
            <span />
          ) : (
            <EmptyState title={emptyTitle} description={emptyDescription} minHeight={220} />
          ),
        }}
      />
      {showPager ? (
        <div className="flex justify-end">
          <Pagination
            page={page}
            limit={limit}
            total={total}
            onPageChange={onPageChange}
            onLimitChange={onLimitChange}
          />
        </div>
      ) : null}
    </div>
  );
}
