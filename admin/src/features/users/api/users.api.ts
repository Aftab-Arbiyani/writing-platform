import type { ApiPagination } from '@/lib/api-client';
import { api } from '@/lib/api-client';
import { downloadExport, exportFilename } from '@/lib/download-export';

import type {
  AdminActionResult,
  AdminLoginHistory,
  AdminUserActivity,
  AdminUserDetail,
  AdminUserListItem,
  AuditLogEntry,
  BulkAction,
  BulkActionResult,
  UpdateUserPayload,
  UserAction,
  UserListParams,
} from '../types/users.types';

/** A paginated slice returned to the list hook (items + offset meta). */
export interface UserListPage {
  items: AdminUserListItem[];
  pagination: ApiPagination | undefined;
}

/** A paginated audit slice. */
export interface AuditPage {
  items: AuditLogEntry[];
  pagination: ApiPagination | undefined;
}

/**
 * The Users feature's `api/` layer — the ONLY place `/admin/users*` endpoints are
 * named (docs 26 §7). Everything goes through the shared `api-client` (Bearer +
 * envelope-unwrap + single-flight refresh). List/audit reads keep `meta.pagination`
 * for the pager; everything else returns the unwrapped `data`.
 */
export const usersApi = {
  /** GET /admin/users — offset page (requires `user.view`). */
  list: (params: UserListParams, signal?: AbortSignal): Promise<UserListPage> =>
    api
      .get<AdminUserListItem[]>('/admin/users', { query: params, signal })
      .then((result) => ({ items: result.data, pagination: result.meta?.pagination })),

  /** GET /admin/users/:id — full detail. */
  detail: (id: string, signal?: AbortSignal): Promise<AdminUserDetail> =>
    api.get<AdminUserDetail>(`/admin/users/${id}`, { signal }).then((result) => result.data),

  /** GET /admin/users/:id/activity. */
  activity: (id: string, signal?: AbortSignal): Promise<AdminUserActivity> =>
    api.get<AdminUserActivity>(`/admin/users/${id}/activity`, { signal }).then((r) => r.data),

  /** GET /admin/users/:id/login-history. */
  loginHistory: (id: string, signal?: AbortSignal): Promise<AdminLoginHistory> =>
    api.get<AdminLoginHistory>(`/admin/users/${id}/login-history`, { signal }).then((r) => r.data),

  /** GET /admin/users/:id/audit — offset page of audit entries. */
  audit: (
    id: string,
    params: { page?: number; limit?: number; action?: string },
    signal?: AbortSignal,
  ): Promise<AuditPage> =>
    api
      .get<AuditLogEntry[]>(`/admin/users/${id}/audit`, { query: params, signal })
      .then((result) => ({ items: result.data, pagination: result.meta?.pagination })),

  /** PATCH /admin/users/:id — edit display name / role / status / verification. */
  update: (id: string, body: UpdateUserPayload): Promise<AdminUserDetail> =>
    api.patch<AdminUserDetail>(`/admin/users/${id}`, body).then((result) => result.data),

  /** POST /admin/users/:id/<action> — a single account action. */
  action: (id: string, action: UserAction, reason?: string): Promise<AdminActionResult> =>
    api
      .post<AdminActionResult>(`/admin/users/${id}/${action}`, reason ? { reason } : {})
      .then((result) => result.data),

  /** POST /admin/users/bulk-actions — apply an action to many ids (≤200). */
  bulk: (action: BulkAction, userIds: string[], reason?: string): Promise<BulkActionResult> =>
    api
      .post<BulkActionResult>('/admin/users/bulk-actions', { action, userIds, reason })
      .then((result) => result.data),
};

/**
 * Streams the filtered user set to a file download. The export endpoint returns a
 * RAW CSV/JSON stream (not the `{success,data}` envelope), so it bypasses the
 * api-client's JSON parsing and hits `fetch` directly — with the same Bearer token
 * + cookie the client uses. Triggers a browser download; never rendered.
 */
export function downloadUserExport(
  params: UserListParams,
  format: 'csv' | 'json',
  signal?: AbortSignal,
): Promise<void> {
  return downloadExport({
    path: '/admin/users/export',
    query: params as Record<string, string | number | undefined>,
    format,
    filename: exportFilename('users', format),
    signal,
  });
}
