import { useCallback } from 'react';
import { useSearchParams } from 'react-router';

/**
 * URL-synced offset pagination (docs/32 §7.3 — admin uses `?page&limit`, the URL is the source of
 * truth for table state; docs/24). Garbage params coerce to defaults. Changing the page size resets
 * to page 1. Defaults (page 1, default limit) are kept OUT of the URL for clean links.
 */
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export interface Pagination {
  page: number;
  limit: number;
  setPage: (page: number) => void;
  setLimit: (limit: number) => void;
}

function coerceInt(value: string | null, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) return fallback;
  return parsed;
}

export function usePagination(defaultLimit: number = DEFAULT_PAGE_SIZE): Pagination {
  const [params, setParams] = useSearchParams();
  const page = coerceInt(params.get('page'), 1, 1, Number.MAX_SAFE_INTEGER);
  const limit = coerceInt(params.get('limit'), defaultLimit, 1, MAX_PAGE_SIZE);

  const setPage = useCallback(
    (next: number) => {
      setParams(
        (prev) => {
          const sp = new URLSearchParams(prev);
          if (next <= 1) sp.delete('page');
          else sp.set('page', String(next));
          return sp;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  const setLimit = useCallback(
    (next: number) => {
      const clamped = Math.min(Math.max(1, next), MAX_PAGE_SIZE);
      setParams(
        (prev) => {
          const sp = new URLSearchParams(prev);
          if (clamped === defaultLimit) sp.delete('limit');
          else sp.set('limit', String(clamped));
          sp.delete('page'); // a page-size change resets to the first page
          return sp;
        },
        { replace: true },
      );
    },
    [setParams, defaultLimit],
  );

  return { page, limit, setPage, setLimit };
}
