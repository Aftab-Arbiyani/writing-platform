import { useCallback, useMemo, useState } from 'react';

import { PAGE_SIZE } from '@/lib/constants';

export interface UsePaginationOptions {
  initialPage?: number;
  pageSize?: number;
  total?: number;
}

export interface UsePaginationResult {
  page: number;
  pageSize: number;
  totalPages: number;
  canPrev: boolean;
  canNext: boolean;
  setPage: (page: number) => void;
  next: () => void;
  prev: () => void;
}

/**
 * Local offset-pagination state (admin tables / analytics). Reader feeds use cursor
 * pagination via `useInfiniteQuery` (docs/05 §5) — not this hook.
 */
export function usePagination({
  initialPage = 1,
  pageSize = PAGE_SIZE.default,
  total,
}: UsePaginationOptions = {}): UsePaginationResult {
  const [page, setPageState] = useState(initialPage);
  const totalPages = total != null ? Math.max(1, Math.ceil(total / pageSize)) : Infinity;

  const setPage = useCallback(
    (next: number) => {
      setPageState(Math.min(Math.max(1, next), totalPages));
    },
    [totalPages],
  );
  const next = useCallback(() => {
    setPageState((p) => Math.min(p + 1, totalPages));
  }, [totalPages]);
  const prev = useCallback(() => {
    setPageState((p) => Math.max(1, p - 1));
  }, []);

  return useMemo(
    () => ({
      page,
      pageSize,
      totalPages,
      canPrev: page > 1,
      canNext: page < totalPages,
      setPage,
      next,
      prev,
    }),
    [page, pageSize, totalPages, setPage, next, prev],
  );
}
