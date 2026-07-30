import { QPagination } from '@qalam/ui';
import type { ReactElement } from 'react';

/**
 * Offset pagination bar (docs/32 §7.3 — admin's model). Wraps the shared `QPagination` (AntD
 * Pagination). Pairs with `usePagination`: pass `page`/`limit`/`total` and the setters. The page-size
 * changer only shows when `onLimitChange` is provided. Shows the running range for operator context.
 */
export interface PaginationProps {
  page: number;
  limit: number;
  total: number;
  onPageChange: (page: number) => void;
  onLimitChange?: (limit: number) => void;
  pageSizeOptions?: number[];
}

export function Pagination({
  page,
  limit,
  total,
  onPageChange,
  onLimitChange,
  pageSizeOptions = [10, 20, 50, 100],
}: PaginationProps): ReactElement {
  return (
    <QPagination
      current={page}
      pageSize={limit}
      total={total}
      showSizeChanger={Boolean(onLimitChange)}
      pageSizeOptions={pageSizeOptions}
      showTotal={(count, [from, to]) => `${from}–${to} of ${count}`}
      onChange={(nextPage, nextSize) => {
        if (onLimitChange && nextSize !== limit) onLimitChange(nextSize);
        else onPageChange(nextPage);
      }}
    />
  );
}
