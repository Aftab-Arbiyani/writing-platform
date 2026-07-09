/**
 * Presentation formatters. Numerals policy (docs/06 §6.5): UI chrome, stats, and dates use
 * Latin (ASCII) digits via the `en` locale — one consistent numeric voice. Author content is
 * never transformed. Timestamps cross the wire as ISO-8601 strings (docs/16 §1.6).
 */
const DATE_FMT = new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', year: 'numeric' });
const DATETIME_FMT = new Intl.DateTimeFormat('en', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});
const COUNT_FMT = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });

function asDate(input: string | Date): Date {
  return typeof input === 'string' ? new Date(input) : input;
}

/** "4 Jul 2026" */
export function formatDate(input: string | Date): string {
  return DATE_FMT.format(asDate(input));
}

/** "4 Jul 2026, 18:30" */
export function formatDateTime(input: string | Date): string {
  return DATETIME_FMT.format(asDate(input));
}

/** Compact relative time: "just now" · "5m" · "3h" · "2d" · "6w"; older → absolute date. */
export function formatRelativeTime(input: string | Date): string {
  const date = asDate(input);
  const seconds = Math.round(Math.abs(Date.now() - date.getTime()) / 1000);
  if (seconds < 45) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${String(minutes)}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${String(hours)}h`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${String(days)}d`;
  if (days < 30) return `${String(Math.round(days / 7))}w`;
  return formatDate(date);
}

/** Compact count: 1200 → "1.2K", 1_500_000 → "1.5M". */
export function formatCount(value: number): string {
  return COUNT_FMT.format(value);
}
