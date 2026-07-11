/**
 * Small, pure display formatters for admin surfaces (stat/metric cards, tables). Locale-aware via
 * Intl; centralised here so no component hand-rolls `toLocaleString`. Domain-pure helpers that
 * belong to the whole platform live in `@qalam/utils`; these are admin-display only.
 */

/** Compact integer with grouping, e.g. 12345 → "12,345". */
export function formatCount(value: number): string {
  return new Intl.NumberFormat().format(value);
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
