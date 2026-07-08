import type { CursorMeta } from '@qalam/shared';

import {
  decodeCursor,
  encodeCursor,
  type CursorPayload,
} from '../../common/pagination/cursor.util';
import { FeedInvalidCursorException } from './exceptions/feed.exceptions';

/**
 * Keyset cursor for feeds. Distinguishes an ABSENT cursor (first page → null)
 * from a PRESENT-but-malformed one (→ `FEED_INVALID_CURSOR` 400, docs 05 §5.1 /
 * cursor.util's "feeds throw FEED_INVALID_CURSOR, Epic 6").
 */
export function parseFeedCursor(raw: string | undefined | null): CursorPayload | null {
  if (raw === undefined || raw === null || raw === '') {
    return null;
  }
  const decoded = decodeCursor(raw);
  if (decoded === null) {
    throw new FeedInvalidCursorException();
  }
  return decoded;
}

/**
 * Opaque index cursor for paginating a cached, immutable snapshot (trending
 * feed, featured writers). This is NOT an offset scan against the DB — it is a
 * position into an in-memory ranked array, so it neither violates the
 * offset-pagination ban nor degrades as the table grows.
 */
export function encodeIndexCursor(nextIndex: number): string {
  return encodeCursor({ k: 'i', id: String(nextIndex) });
}

/** Decodes an index cursor to its start position; throws on a malformed value. */
export function parseIndexCursor(raw: string | undefined | null): number {
  if (raw === undefined || raw === null || raw === '') {
    return 0;
  }
  const decoded = decodeCursor(raw);
  const index = decoded === null ? NaN : Number(decoded.id);
  if (!Number.isInteger(index) || index < 0) {
    throw new FeedInvalidCursorException();
  }
  return index;
}

/**
 * Pages an in-memory ranked snapshot with an index cursor, emitting the standard
 * cursor `meta` (`nextCursor` / `hasMore` / `limit`, docs 05 §5.1). Used for
 * cached top-N rankings (trending, featured writers).
 */
export function paginateSnapshot<T>(
  all: T[],
  rawCursor: string | undefined,
  limit: number,
): { items: T[]; meta: CursorMeta } {
  const start = parseIndexCursor(rawCursor);
  const items = all.slice(start, start + limit);
  const nextIndex = start + items.length;
  const hasMore = nextIndex < all.length;
  return {
    items,
    meta: { nextCursor: hasMore ? encodeIndexCursor(nextIndex) : null, hasMore, limit },
  };
}
