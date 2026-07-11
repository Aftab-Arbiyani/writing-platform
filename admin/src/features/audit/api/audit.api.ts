import type { ApiPagination } from '@/lib/api-client';
import { api } from '@/lib/api-client';
import { downloadExport, exportFilename } from '@/lib/download-export';

import type { AuditListParams, AuditLog, AuditStatistics } from '../types/audit.types';

export interface AuditPage {
  items: AuditLog[];
  pagination: ApiPagination | undefined;
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
export function downloadAuditExport(
  params: AuditListParams,
  format: 'csv' | 'json',
  signal?: AbortSignal,
): Promise<void> {
  return downloadExport({
    path: '/admin/audit-logs/export',
    query: params as Record<string, string | number | undefined>,
    format,
    filename: exportFilename('audit', format),
    signal,
  });
}
