import type { Role } from '@qalam/shared';

import type { ApiPagination } from '@/lib/api-client';
import { api } from '@/lib/api-client';
import { downloadExport, exportFilename } from '@/lib/download-export';

import type {
  Appeal,
  AppealDetail,
  AppealListParams,
  BulkReportPayload,
  BulkReportResult,
  Moderator,
  Report,
  ReportDetail,
  ReportListParams,
  ReportNote,
  ReportStatistics,
  ReportTimelineEntry,
  ReportTrends,
  ResolvePayload,
  UpdateReportPayload,
} from '../types/moderation.types';

export interface ReportPage {
  items: Report[];
  pagination: ApiPagination | undefined;
}

export interface AppealPage {
  items: Appeal[];
  pagination: ApiPagination | undefined;
}

/** Roles that can be assigned a report. */
const ASSIGNABLE_ROLES = ['moderator', 'admin', 'super_admin'];

/**
 * The Moderation feature's `api/` layer — the only place `/admin/reports`,
 * `/admin/appeals`, and `/admin/moderation/*` are named (docs 26 §7). All go
 * through the shared api-client; list reads keep `meta.pagination` for the pager.
 */
export const moderationApi = {
  listReports: (params: ReportListParams, signal?: AbortSignal): Promise<ReportPage> =>
    api
      .get<Report[]>('/admin/reports', { query: params, signal })
      .then((result) => ({ items: result.data, pagination: result.meta?.pagination })),

  report: (id: string, signal?: AbortSignal): Promise<ReportDetail> =>
    api.get<ReportDetail>(`/admin/reports/${id}`, { signal }).then((r) => r.data),

  assign: (id: string, moderatorId: string): Promise<Report> =>
    api.post<Report>(`/admin/reports/${id}/assign`, { moderatorId }).then((r) => r.data),

  setPriority: (id: string, priority: string): Promise<Report> =>
    api.patch<Report>(`/admin/reports/${id}/priority`, { priority }).then((r) => r.data),

  escalate: (id: string): Promise<Report> =>
    api.post<Report>(`/admin/reports/${id}/escalate`, {}).then((r) => r.data),

  addNote: (id: string, body: string): Promise<ReportNote> =>
    api.post<ReportNote>(`/admin/reports/${id}/notes`, { body }).then((r) => r.data),

  updateNote: (id: string, noteId: string, body: string): Promise<ReportNote> =>
    api.patch<ReportNote>(`/admin/reports/${id}/notes/${noteId}`, { body }).then((r) => r.data),

  deleteNote: (id: string, noteId: string): Promise<void> =>
    api.delete<undefined>(`/admin/reports/${id}/notes/${noteId}`).then(() => undefined),

  resolve: (id: string, payload: ResolvePayload): Promise<Report> =>
    api.post<Report>(`/admin/reports/${id}/resolve`, payload).then((r) => r.data),

  /** PATCH /admin/reports/:id — unified update (assign/priority/resolve/close/reopen). */
  updateReport: (id: string, payload: UpdateReportPayload): Promise<Report> =>
    api.patch<Report>(`/admin/reports/${id}`, payload).then((r) => r.data),

  timeline: (id: string, signal?: AbortSignal): Promise<ReportTimelineEntry[]> =>
    api.get<ReportTimelineEntry[]>(`/admin/reports/${id}/timeline`, { signal }).then((r) => r.data),

  statistics: (signal?: AbortSignal): Promise<ReportStatistics> =>
    api.get<ReportStatistics>('/admin/reports/statistics', { signal }).then((r) => r.data),

  trends: (params: { from?: string; to?: string }, signal?: AbortSignal): Promise<ReportTrends> =>
    api.get<ReportTrends>('/admin/reports/trends', { query: params, signal }).then((r) => r.data),

  bulk: (payload: BulkReportPayload): Promise<BulkReportResult> =>
    api.post<BulkReportResult>('/admin/reports/bulk-actions', payload).then((r) => r.data),

  listAppeals: (params: AppealListParams, signal?: AbortSignal): Promise<AppealPage> =>
    api
      .get<Appeal[]>('/admin/appeals', { query: params, signal })
      .then((result) => ({ items: result.data, pagination: result.meta?.pagination })),

  appeal: (id: string, signal?: AbortSignal): Promise<AppealDetail> =>
    api.get<AppealDetail>(`/admin/appeals/${id}`, { signal }).then((r) => r.data),

  approveAppeal: (id: string, notes?: string): Promise<Appeal> =>
    api.post<Appeal>(`/admin/appeals/${id}/approve`, notes ? { notes } : {}).then((r) => r.data),

  rejectAppeal: (id: string, notes?: string): Promise<Appeal> =>
    api.post<Appeal>(`/admin/appeals/${id}/reject`, notes ? { notes } : {}).then((r) => r.data),

  /** Assignable moderators/admins, from the existing `/admin/users` list (E12.5). */
  moderators: async (signal?: AbortSignal): Promise<Moderator[]> => {
    const rows = await Promise.all(
      ASSIGNABLE_ROLES.map((role) =>
        api
          .get<Array<{ id: string; username: string; displayName: string | null; role: Role }>>(
            '/admin/users',
            { query: { role, limit: 100 }, signal },
          )
          .then((r) => r.data),
      ),
    );
    return rows.flat().map((user) => ({
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
    }));
  },
};

/**
 * Streams the filtered report set to a file download (E12.7). The export endpoint
 * returns a RAW CSV/JSON stream (not the envelope), so it bypasses the api-client
 * and hits `fetch` directly with the same Bearer token + cookie.
 */
export function downloadReportExport(
  params: ReportListParams,
  format: 'csv' | 'json',
  signal?: AbortSignal,
): Promise<void> {
  return downloadExport({
    path: '/admin/reports/export',
    query: params as Record<string, string | number | undefined>,
    format,
    filename: exportFilename('reports', format),
    signal,
  });
}
