import type { ApiPagination } from '@/lib/api-client';
import { api, getAccessToken } from '@/lib/api-client';
import { env } from '@/config/env';

import type {
  AdminActionResult,
  AdminLoginHistory,
  AdminUserActivity,
  AdminUserDetail,
  AdminUserListItem,
  AdminUserStatistics,
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

  /** GET /admin/users/:id/statistics. */
  statistics: (id: string, signal?: AbortSignal): Promise<AdminUserStatistics> =>
    api
      .get<AdminUserStatistics>(`/admin/users/${id}/statistics`, { signal })
      .then((result) => result.data),

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
export async function downloadUserExport(
  params: UserListParams,
  format: 'csv' | 'json',
  signal?: AbortSignal,
): Promise<void> {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...params, format })) {
    if (value !== undefined && value !== '') {
      search.set(key, String(value));
    }
  }
  const token = getAccessToken();
  const response = await fetch(`${env.VITE_API_URL}/admin/users/export?${search.toString()}`, {
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
  const stamp = new Date().toISOString().slice(0, 10);
  anchor.href = url;
  anchor.download = `qalam-users-${stamp}.${format}`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
