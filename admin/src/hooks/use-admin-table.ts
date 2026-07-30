import { useMemo } from 'react';

import { useBulkSelection, type BulkSelection } from '@/hooks/use-bulk-selection';
import { useFilters, type Filters } from '@/hooks/use-filters';
import { usePagination, type Pagination } from '@/hooks/use-pagination';

/**
 * The one hook an admin list page reaches for: composes URL-synced pagination + filters with local
 * bulk-selection, and derives the `queryParams` object a feature `api/` hook passes straight to the
 * client (`?page&limit&<filters>`). Keeps every table page consistent (docs/24, docs/32 §7.3).
 * Feature epics call e.g. `useUsers(table.queryParams)`.
 */
export interface AdminTable<K extends string, Id extends string = string> {
  pagination: Pagination;
  filters: Filters<K>;
  selection: BulkSelection<Id>;
  /** Flattened params for the list request: `{ page, limit, ...activeFilters }`. */
  queryParams: Record<string, string | number>;
}

export function useAdminTable<K extends string, Id extends string = string>(
  filterKeys: readonly K[] = [] as readonly K[],
  defaultLimit?: number,
): AdminTable<K, Id> {
  const pagination = usePagination(defaultLimit);
  const filters = useFilters<K>(filterKeys);
  const selection = useBulkSelection<Id>();

  const queryParams = useMemo<Record<string, string | number>>(() => {
    const params: Record<string, string | number> = {
      page: pagination.page,
      limit: pagination.limit,
    };
    for (const key of filterKeys) {
      const value = filters.values[key];
      if (value !== undefined) params[key] = value;
    }
    return params;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- filterKeys is a stable literal per call site
  }, [pagination.page, pagination.limit, filters.values, filterKeys.join('|')]);

  return { pagination, filters, selection, queryParams };
}
