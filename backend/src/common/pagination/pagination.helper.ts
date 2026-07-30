import type { CursorMeta, OffsetMeta } from '@qalam/shared';

import { encodeCursor, type CursorPayload } from './cursor.util';

/**
 * Builders for the pagination `meta` block (ADR §5). Repositories over-fetch one
 * row (`limit + 1`) to detect more pages without a `COUNT(*)` on hot paths
 * (docs 04); these helpers turn that raw result into the wire `meta`.
 */

/**
 * Builds cursor `meta` from an over-fetched page. Pass `limit + 1` rows in
 * `rows`; this trims to `limit`, sets `hasMore`, and derives `nextCursor` from
 * the last kept row via `toCursor`.
 *
 * @returns the trimmed items and the cursor meta — the caller returns
 *          `{ items, meta }` (see {@link CursorPage}).
 */
export function buildCursorPage<TRow>(
  rows: TRow[],
  limit: number,
  toCursor: (row: TRow) => CursorPayload,
): { items: TRow[]; meta: CursorMeta } {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const last = items.at(-1);
  const nextCursor = hasMore && last !== undefined ? encodeCursor(toCursor(last)) : null;

  return { items, meta: { nextCursor, hasMore, limit } };
}

/** Builds offset `meta` (admin tables — totals are acceptable there, docs 05 §5.2). */
export function buildOffsetMeta(page: number, limit: number, total: number): OffsetMeta {
  return {
    page,
    limit,
    total,
    totalPages: limit > 0 ? Math.ceil(total / limit) : 0,
  };
}
