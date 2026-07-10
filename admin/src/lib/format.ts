/**
 * Small, pure display formatters for admin surfaces (stat/metric cards, tables). Locale-aware via
 * Intl; centralised here so no component hand-rolls `toLocaleString`. Domain-pure helpers that
 * belong to the whole platform live in `@qalam/utils`; these are admin-display only.
 */

/** Compact integer with grouping, e.g. 12345 → "12,345". */
export function formatCount(value: number): string {
  return new Intl.NumberFormat().format(value);
}

/** Abbreviated large numbers for dense tiles, e.g. 12345 → "12.3K". */
export function formatCompact(value: number): string {
  return new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(
    value,
  );
}

/** A ratio 0–1 as a whole percent, e.g. 0.732 → "73%". */
export function formatPercent(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

/** Absolute date, e.g. "10 Jul 2026". */
export function formatDate(value: string | number | Date): string {
  return new Intl.DateTimeFormat(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

/** Date + time for audit-style rows, e.g. "10 Jul 2026, 14:05". */
export function formatDateTime(value: string | number | Date): string {
  return new Intl.DateTimeFormat(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}
