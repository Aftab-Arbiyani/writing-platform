import type { AdminTrendRange } from './analytics.constants';

/** A resolved analytics window: absolute bounds + a stable cache-key fragment. */
export interface ResolvedRange {
  from: Date;
  to: Date;
  /** Whole days in the window (for interval maths + previous-period comparison). */
  days: number;
  /** Deterministic key fragment for caching (range + filters folded in by caller). */
  key: string;
}

const DAY_MS = 86_400_000;

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/**
 * Resolves an admin trend range preset (or a custom from/to) into absolute UTC
 * bounds (E12.9). `custom` requires both `from` and `to`; an invalid/absent
 * custom range falls back to the last 30 days. All windows are half-open
 * `[from, to)` in spirit; callers use `created_at >= from AND < to` (or `<= to`).
 */
export function resolveRange(range: AdminTrendRange, from?: string, to?: string): ResolvedRange {
  const now = new Date();
  const todayStart = startOfUtcDay(now);

  switch (range) {
    case 'today':
      return finalize(todayStart, now);
    case 'yesterday': {
      const start = new Date(todayStart.getTime() - DAY_MS);
      return finalize(start, todayStart);
    }
    case '7d':
      return finalize(new Date(now.getTime() - 7 * DAY_MS), now);
    case '90d':
      return finalize(new Date(now.getTime() - 90 * DAY_MS), now);
    case 'year':
      return finalize(new Date(now.getTime() - 365 * DAY_MS), now);
    case 'custom': {
      const start = from !== undefined ? new Date(from) : null;
      const end = to !== undefined ? new Date(to) : null;
      if (
        start !== null &&
        end !== null &&
        !Number.isNaN(start.getTime()) &&
        !Number.isNaN(end.getTime())
      ) {
        return finalize(start, end);
      }
      return finalize(new Date(now.getTime() - 30 * DAY_MS), now);
    }
    case '30d':
    default:
      return finalize(new Date(now.getTime() - 30 * DAY_MS), now);
  }
}

function finalize(from: Date, to: Date): ResolvedRange {
  const days = Math.max(1, Math.round((to.getTime() - from.getTime()) / DAY_MS));
  return { from, to, days, key: `${from.toISOString()}_${to.toISOString()}` };
}

/** The equal-length window immediately preceding a resolved range (for growth %). */
export function previousRange(range: ResolvedRange): { from: Date; to: Date } {
  const span = range.to.getTime() - range.from.getTime();
  return { from: new Date(range.from.getTime() - span), to: range.from };
}
