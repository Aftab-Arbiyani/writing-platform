import type { ApiPagination } from '@/lib/api-client';
import { api, getAccessToken } from '@/lib/api-client';
import { env } from '@/config/env';

import type { AuditListParams, AuditLog, AuditStatistics } from '../types/audit.types';

export interface AuditPage {
  items: AuditLog[];
  pagination: ApiPagination | undefined;
}

/** Builds a URLSearchParams from a filter object, skipping empty values. */
function toSearch(params: Record<string, unknown>): URLSearchParams {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') {
      search.set(key, String(value));
    }
  }
  return search;
}

/**
 * The Audit feature's `api/` layer — the only place `/admin/audit-logs*` is named
 * (docs 26 §7). Goes through the shared api-client; the list keeps `meta.pagination`.
 */
export const auditApi = {
  list: (params: AuditListParams, signal?: AbortSignal): Promise<AuditPage> =>
    api
      .get<AuditLog[]>('/admin/audit-logs', { query: params, signal })
      .then((result) => ({ items: result.data, pagination: result.meta?.pagination })),

  detail: (id: string, signal?: AbortSignal): Promise<AuditLog> =>
    api.get<AuditLog>(`/admin/audit-logs/${id}`, { signal }).then((r) => r.data),

  statistics: (signal?: AbortSignal): Promise<AuditStatistics> =>
    api.get<AuditStatistics>('/admin/audit-logs/statistics', { signal }).then((r) => r.data),
};

/**
 * Streams the filtered audit set to a file download. The export endpoint returns a
 * RAW CSV/JSON stream (not the `{success,data}` envelope), so it bypasses the
 * api-client and hits `fetch` directly with the same Bearer token + cookie.
 */
export async function downloadAuditExport(
  params: AuditListParams,
  format: 'csv' | 'json',
  signal?: AbortSignal,
): Promise<void> {
  const search = toSearch({ ...params, format });
  const token = getAccessToken();
  const response = await fetch(`${env.VITE_API_URL}/admin/audit-logs/export?${search.toString()}`, {
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
  anchor.download = `qalam-audit-${new Date().toISOString().slice(0, 10)}.${format}`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
