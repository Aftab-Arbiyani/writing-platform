/**
 * Client-side analytics export (docs: Export CSV / JSON / print). `v1` has NO `/analytics/export`
 * endpoint, so we serialize the already-fetched payloads in the browser — no extra request, no
 * fabricated data. Pure serializers + a download trigger; the export menu assembles the rows.
 */

/** One labelled metric for the CSV/JSON export. */
export interface ExportRow {
  metric: string;
  value: string | number;
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
