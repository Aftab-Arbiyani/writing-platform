import type { NotificationItem } from '../types/notification.types';

/**
 * Groups a newest-first notification list into date buckets (docs/06 §3.9 "grouped") — the
 * pagination-safe way to group a cursor feed (buckets never span a page boundary incorrectly the
 * way actor-collapse aggregation would; the E9 backend does no cross-actor aggregation). Order is
 * preserved within and across buckets. Boundaries are computed from the local "start of today".
 */
export interface NotificationGroup {
  key: string;
  label: string;
  items: NotificationItem[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

interface Bucket {
  key: string;
  label: string;
  /** Inclusive lower bound (ms epoch); items at/after this and before the previous bucket. */
  after: number;
}

function buckets(now: Date): Bucket[] {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return [
    { key: 'today', label: 'Today', after: startOfToday },
    { key: 'yesterday', label: 'Yesterday', after: startOfToday - DAY_MS },
    { key: 'week', label: 'Earlier this week', after: startOfToday - 7 * DAY_MS },
    { key: 'month', label: 'Earlier this month', after: startOfToday - 30 * DAY_MS },
    { key: 'older', label: 'Older', after: Number.NEGATIVE_INFINITY },
  ];
}

export function groupByDate(items: NotificationItem[]): NotificationGroup[] {
  const now = new Date();
  const defs = buckets(now);
  const map = new Map<string, NotificationItem[]>(defs.map((b) => [b.key, []]));

  for (const item of items) {
    const at = new Date(item.createdAt).getTime();
    // The final bucket has `after: -Infinity`, so `find` always matches; `?? 'older'` satisfies TS.
    const bucket = defs.find((b) => at >= b.after);
    map.get(bucket?.key ?? 'older')?.push(item);
  }

  return defs
    .map((b) => ({ key: b.key, label: b.label, items: map.get(b.key) ?? [] }))
    .filter((group) => group.items.length > 0);
}
