import { encodeCursor } from '../../common/pagination/cursor.util';
import { FeedInvalidCursorException } from './exceptions/feed.exceptions';
import {
  encodeIndexCursor,
  paginateSnapshot,
  parseFeedCursor,
  parseIndexCursor,
} from './feed-cursor.util';

describe('parseFeedCursor', () => {
  it('treats an absent cursor as the first page (null)', () => {
    expect(parseFeedCursor(undefined)).toBeNull();
    expect(parseFeedCursor('')).toBeNull();
  });

  it('decodes a valid keyset cursor', () => {
    const raw = encodeCursor({ k: '2026-07-08T00:00:00.000Z', id: 'abc' });
    expect(parseFeedCursor(raw)).toEqual({ k: '2026-07-08T00:00:00.000Z', id: 'abc' });
  });

  it('rejects a present-but-malformed cursor with FEED_INVALID_CURSOR', () => {
    expect(() => parseFeedCursor('%%%not-base64%%%')).toThrow(FeedInvalidCursorException);
  });
});

describe('index cursor + paginateSnapshot', () => {
  const items = Array.from({ length: 10 }, (_, i) => `item${i}`);

  it('round-trips an index cursor', () => {
    expect(parseIndexCursor(encodeIndexCursor(4))).toBe(4);
    expect(parseIndexCursor(undefined)).toBe(0);
  });

  it('pages a snapshot with hasMore + nextCursor, then finishes', () => {
    const first = paginateSnapshot(items, undefined, 4);
    expect(first.items).toEqual(['item0', 'item1', 'item2', 'item3']);
    expect(first.meta.hasMore).toBe(true);
    expect(first.meta.nextCursor).not.toBeNull();

    const second = paginateSnapshot(items, first.meta.nextCursor ?? undefined, 4);
    expect(second.items).toEqual(['item4', 'item5', 'item6', 'item7']);
    expect(second.meta.hasMore).toBe(true);

    const third = paginateSnapshot(items, second.meta.nextCursor ?? undefined, 4);
    expect(third.items).toEqual(['item8', 'item9']);
    expect(third.meta.hasMore).toBe(false);
    expect(third.meta.nextCursor).toBeNull();
  });

  it('rejects a malformed index cursor', () => {
    expect(() => parseIndexCursor('@@bad@@')).toThrow(FeedInvalidCursorException);
  });
});
