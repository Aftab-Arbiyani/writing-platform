/**
 * Analytics number formatting (docs/06 §6.5 — Latin digits, one numeric voice). Counts reuse the
 * app's compact formatter; analytics adds percent + duration helpers. Kept pure so charts + cards +
 * the a11y tables all speak the same language.
 */

/** A ratio in 0–1 → a whole-percent string ("0.653" → "65%"). */
export function formatPercent(ratio: number): string {
  if (!Number.isFinite(ratio)) return '0%';
  return `${String(Math.round(ratio * 100))}%`;
}

/** Short duration for per-read averages: "312" → "5m 12s", "45" → "45s", "0" → "0s". */
export function formatDurationShort(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  if (total < 60) return `${String(total)}s`;
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  if (mins < 60) return secs === 0 ? `${String(mins)}m` : `${String(mins)}m ${String(secs)}s`;
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  return remMins === 0 ? `${String(hours)}h` : `${String(hours)}h ${String(remMins)}m`;
}

/** Long duration for large totals: "1123200" → "312h", "5400" → "1.5h", "600" → "10m". */
export function formatDurationLong(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  if (total < 3600) return `${String(Math.max(1, Math.round(total / 60)))}m`;
  const hours = total / 3600;
  if (hours < 100) {
    const rounded = Math.round(hours * 10) / 10;
    return `${String(rounded % 1 === 0 ? Math.round(rounded) : rounded)}h`;
  }
  return `${String(Math.round(hours))}h`;
}
