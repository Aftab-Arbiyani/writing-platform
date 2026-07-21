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

/** USD currency, e.g. 1234.5 → "$1,234.50". */
export function formatUsd(value: number): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(value);
}

/**
 * A ratio or already-scaled percentage rendered as a percent, e.g. 0.997 → "99.7%", 42 → "42.0%".
 * Values in [0, 1] are treated as ratios (×100); anything larger is assumed already a percentage.
 */
export function formatPercent(value: number, fractionDigits = 1): string {
  const percent = value >= 0 && value <= 1 ? value * 100 : value;
  return `${percent.toFixed(fractionDigits)}%`;
}

/** Milliseconds with grouping, e.g. 1234.5 → "1,235 ms". */
export function formatMs(value: number): string {
  return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value)} ms`;
}

/** Humanized duration from seconds (compact, at most two units), e.g. 93784 → "1d 2h". */
export function formatDuration(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return '—';
  const seconds = Math.floor(totalSeconds);
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  const secs = seconds % 60;
  const parts: string[] = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  if (secs && parts.length < 2) parts.push(`${secs}s`);
  return parts.slice(0, 2).join(' ') || '0s';
}
