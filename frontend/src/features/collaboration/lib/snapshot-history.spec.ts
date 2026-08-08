import { describe, expect, it } from 'vitest';

import type { StorySnapshotHistory } from '../types/collaboration.types';
import { resolveSnapshotHistoryNotice } from './snapshot-history';

/**
 * B7's client wording, decided in one pure place (docs/45 §4.12).
 *
 * The two things worth pinning: the count is read from the TRUE total (not the clamped list), and
 * the sentence is an offer about versions that still exist — never a deletion notice, never a wait.
 */

function history(over: Partial<StorySnapshotHistory> = {}): StorySnapshotHistory {
  return {
    items: [],
    total: 32,
    visible: 5,
    hidden: 27,
    limit: 5,
    unlimited: false,
    ...over,
  };
}

describe('resolveSnapshotHistoryNotice', () => {
  it('counts from the true total, not the clamped list — "5 of 32 versions"', () => {
    const notice = resolveSnapshotHistoryNotice(history());

    expect(notice.countLabel).toBe('5 of 32 versions');
    expect(notice.limited).toBe(true);
  });

  it('says the hidden versions are saved, and that a plan brings them back', () => {
    const notice = resolveSnapshotHistoryNotice(history());

    expect(notice.headline).toBe('27 older versions are saved but not shown.');
    expect(notice.description).toContain('Nothing was deleted');
    expect(notice.description).toContain('larger plan');
  });

  it('never offers a wait or a deletion as the remedy', () => {
    const notice = resolveSnapshotHistoryNotice(history());

    const copy = `${notice.headline ?? ''} ${notice.description ?? ''}`;

    // Conflating a stock cap's remedy with a flow cap's is the W4 defect (docs/48 §3.6): nothing
    // resets here, so "wait" would never come true.
    expect(copy).not.toMatch(/try again|please wait|resets?\b|next (month|period|cycle)|later/i);
    // And unlike B4 and B6, deleting something is exactly what does NOT reveal an older version —
    // so the copy must never suggest it. (Stating that nothing WAS deleted is the opposite claim.)
    expect(copy).not.toMatch(/\b(delete|remove) (a|an|one|some|your)\b/i);
    expect(copy).toContain('Nothing was deleted');
  });

  it('reads the singular case', () => {
    const notice = resolveSnapshotHistoryNotice(history({ total: 6, visible: 5, hidden: 1 }));

    expect(notice.countLabel).toBe('5 of 6 versions');
    expect(notice.headline).toBe('1 older version is saved but not shown.');
  });

  it('says nothing on an unlimited plan', () => {
    const notice = resolveSnapshotHistoryNotice(
      history({ visible: 32, hidden: 0, limit: 0, unlimited: true }),
    );

    // `limit: 0` here is UNLIMITED — the ordinary sentinel. Branching on the number instead of the
    // server's boolean would read Pro and Enterprise as showing zero versions.
    expect(notice.limited).toBe(false);
    expect(notice.countLabel).toBeNull();
  });

  it('says nothing when the whole history already fits inside the plan', () => {
    const notice = resolveSnapshotHistoryNotice(history({ total: 3, visible: 3, hidden: 0 }));

    // "3 of 3 versions" is noise beside a list that already shows three rows.
    expect(notice.countLabel).toBeNull();
    expect(notice.limited).toBe(false);
  });

  it('says nothing before the history has loaded', () => {
    expect(resolveSnapshotHistoryNotice(undefined)).toEqual({
      countLabel: null,
      limited: false,
      headline: null,
      description: null,
    });
  });
});
