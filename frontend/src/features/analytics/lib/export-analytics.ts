import { formatPercent } from './format-metrics';
import type { BoundedCount, ReaderAnalytics, WriterAnalytics } from '../types/analytics.types';

/**
 * Client-side analytics export (docs: Export CSV / JSON / print). `v1` has NO `/analytics/export`
 * endpoint, so we serialize the already-fetched payloads in the browser — no extra request, no
 * fabricated data. Pure serializers, the per-audience row builders, and a download trigger.
 */

/** One labelled metric for the CSV/JSON export. */
export interface ExportRow {
  metric: string;
  value: string | number;
}

/**
 * The WRITER's export rows (`qalam-analytics`) — reach, engagement received, followers.
 *
 * Writer figures ONLY. Four reader rows used to be appended here; W7c moved them to
 * `readerExportRows` when the reader surface got its own home, because an export named
 * `qalam-analytics` that silently mixed in what the user had READ was the same audience confusion
 * the row fixed on screen.
 */
export function writerExportRows(
  writer: WriterAnalytics,
  followers: number | undefined,
): ExportRow[] {
  return [
    { metric: 'Total views', value: writer.totalViews },
    { metric: 'Unique views', value: writer.uniqueViews },
    { metric: 'Reads', value: writer.reads },
    { metric: 'Completion rate', value: formatPercent(writer.completionRate) },
    { metric: 'Average reading time (seconds)', value: writer.averageReadTimeSeconds },
    ...(followers !== undefined ? [{ metric: 'Followers', value: followers }] : []),
    { metric: 'Followers gained', value: writer.followersGained },
    { metric: 'Published pieces', value: writer.piecesPublished },
    { metric: 'Comments received', value: writer.commentsReceived },
    { metric: 'Claps received', value: writer.clapsReceived },
    { metric: 'Bookmarks received', value: writer.bookmarksReceived },
    { metric: 'Responses received', value: writer.responsesReceived },
  ];
}

/**
 * The READER's export rows (`qalam-reading`, W7c) — the seven aggregate fields plus the ranked
 * lists, and the bounded bookmarks count when it loaded.
 *
 * The bookmarks row is LABELLED "at least" when more exist, because the number alone would read
 * as a total. A row is omitted entirely rather than exported as `0` when its read failed — the
 * same rule the page renders by.
 */
export function readerExportRows(reader: ReaderAnalytics, bookmarks?: BoundedCount): ExportRow[] {
  const rows: ExportRow[] = [
    { metric: 'Pieces read', value: reader.piecesRead },
    { metric: 'Reading time (seconds)', value: reader.readingTimeSeconds },
    { metric: 'Completed reads', value: reader.completedReads },
    { metric: 'Current reading streak (days)', value: reader.currentStreak },
    { metric: 'Longest reading streak (days)', value: reader.longestStreak },
  ];
  if (bookmarks) {
    rows.push({
      metric: bookmarks.hasMore ? 'Bookmarks (at least)' : 'Bookmarks',
      value: bookmarks.count,
    });
  }
  for (const genre of reader.favoriteGenres) {
    rows.push({ metric: `Genre read — ${genre.label}`, value: genre.count });
  }
  for (const language of reader.favoriteLanguages) {
    rows.push({ metric: `Language read — ${language.label}`, value: language.count });
  }
  return rows;
}

export function toJSON(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

function escapeCsv(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** A two-column (Metric, Value) CSV — the shape the dashboard + piece exports use. */
export function rowsToCsv(rows: ExportRow[]): string {
  const header = 'Metric,Value';
  const body = rows.map((r) => `${escapeCsv(r.metric)},${escapeCsv(r.value)}`).join('\n');
  return `${header}\n${body}\n`;
}

/**
 * Trigger a file download in the browser. Falls back to a `data:` URL where
 * `URL.createObjectURL` is unavailable (jsdom / older engines) so it never throws.
 */
export function downloadFile(filename: string, content: string, mime: string): void {
  const anchor = document.createElement('a');
  anchor.download = filename;

  if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
    const url = URL.createObjectURL(new Blob([content], { type: mime }));
    anchor.href = url;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    return;
  }

  anchor.href = `data:${mime};charset=utf-8,${encodeURIComponent(content)}`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}
