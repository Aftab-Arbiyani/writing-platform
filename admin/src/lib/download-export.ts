import { env } from '@/config/env';
import { getAccessToken } from '@/lib/api-client';

/**
 * Streams a raw export (CSV/JSON) to a file download (A9 — consolidates the
 * blob-download boilerplate previously copied in users / audit / reports /
 * analytics). Export endpoints return a RAW stream (not the `{success,data}`
 * envelope), so this is the one sanctioned path that bypasses the api-client; it
 * still sends the same Bearer token + cookie. Centralizes the deferred
 * `revokeObjectURL` (a synchronous revoke can abort the download in some browsers).
 */
export async function downloadExport(options: {
  path: string;
  query: Record<string, string | number | undefined>;
  format: 'csv' | 'json';
  filename: string;
  signal?: AbortSignal;
}): Promise<void> {
  const { path, query, format, filename, signal } = options;
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') {
      search.set(key, String(value));
    }
  }
  search.set('format', format);
  const token = getAccessToken();
  const response = await fetch(`${env.VITE_API_URL}${path}?${search.toString()}`, {
    method: 'GET',
    credentials: 'include',
    headers: {
      Accept: format === 'json' ? 'application/json' : 'text/csv',
      ...(token !== null ? { Authorization: `Bearer ${token}` } : {}),
    },
    signal,
  });
  if (!response.ok) {
    throw new Error(`Export failed (${response.status})`);
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  // Defer the revoke so the download isn't aborted mid-flight.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** Standard export filename: `qalam-<kind>-<YYYY-MM-DD>.<format>`. */
export function exportFilename(kind: string, format: 'csv' | 'json'): string {
  return `qalam-${kind}-${new Date().toISOString().slice(0, 10)}.${format}`;
}
