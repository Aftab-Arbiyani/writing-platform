import type { TimeRange } from '../stores/dashboard.store';

/**
 * Converts a `TimeRange` preference into a concrete `{ from, to }` window (ISO date strings) for the
 * dashboard queries. `today` = midnight→now; `7d`/`30d` = rolling windows; `custom` uses the stored
 * bounds (falling back to the last 7 days if unset). Pure — the current time is injected so it stays
 * testable and deterministic.
 */
export interface DateWindow {
  from: string;
  to: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function resolveTimeRange(
  range: TimeRange,
  now: Date,
  custom?: { from: string | null; to: string | null },
): DateWindow {
  const to = now.toISOString();

  if (range === 'custom' && custom?.from && custom.to) {
    return { from: new Date(custom.from).toISOString(), to: new Date(custom.to).toISOString() };
  }

  if (range === 'today') {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    return { from: start.toISOString(), to };
  }

  const days = range === '30d' ? 30 : 7;
  return { from: new Date(now.getTime() - days * DAY_MS).toISOString(), to };
}

/** Human label for the range chips + widget captions. */
export const TIME_RANGE_LABELS: Record<TimeRange, string> = {
  today: 'Today',
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  custom: 'Custom range',
};
