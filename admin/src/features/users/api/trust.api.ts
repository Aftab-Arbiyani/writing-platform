import { api } from '@/lib/api-client';

import type {
  AdminRestriction,
  AdminStrike,
  AdminTrustSummary,
  ApplyRestrictionPayload,
  IssueStrikePayload,
} from '../types/trust.types';

/**
 * The Trust admin surface's `api/` layer (AF6, row A2; extended by B9) — the ONLY place the
 * seven `trust.admin.controller.ts` paths are named. Everything goes through the shared
 * `api-client` (Bearer + envelope-unwrap + single-flight refresh).
 *
 * **Five of the seven routes are keyed by USER id; the two deletes are keyed by the ROW's id.**
 * `DELETE /admin/restrictions/:id` and `DELETE /admin/strikes/:id` each take their own row's id —
 * the asymmetry is in the controller, so it is named here once, loudly, rather than left for a
 * caller to get wrong. All three kinds of id are UUIDs, so the wrong one 404s instead of failing
 * to compile.
 *
 * The three per-user reads now 404 for an id that belongs to nobody (B9, A2-4) instead of
 * answering a clean standing for any well-formed UUID.
 */
export const trustApi = {
  /** GET /admin/users/:id/trust — the standing (`trust.view`). */
  summary: (userId: string, signal?: AbortSignal): Promise<AdminTrustSummary> =>
    api.get<AdminTrustSummary>(`/admin/users/${userId}/trust`, { signal }).then((r) => r.data),

  /** GET /admin/users/:id/restrictions — active AND historical, newest first (`trust.view`). */
  restrictions: (userId: string, signal?: AbortSignal): Promise<AdminRestriction[]> =>
    api
      .get<AdminRestriction[]>(`/admin/users/${userId}/restrictions`, { signal })
      .then((r) => r.data),

  /** GET /admin/users/:id/strikes — active AND historical, newest first (`trust.view`, B9/A2-2). */
  strikes: (userId: string, signal?: AbortSignal): Promise<AdminStrike[]> =>
    api.get<AdminStrike[]>(`/admin/users/${userId}/strikes`, { signal }).then((r) => r.data),

  /** POST /admin/users/:id/strikes — issue a strike; auto-escalates at a threshold (`trust.manage`). */
  issueStrike: (userId: string, body: IssueStrikePayload): Promise<AdminStrike> =>
    api.post<AdminStrike>(`/admin/users/${userId}/strikes`, body).then((r) => r.data),

  /** POST /admin/users/:id/restrictions — apply a restriction (`trust.manage`). */
  applyRestriction: (userId: string, body: ApplyRestrictionPayload): Promise<AdminRestriction> =>
    api.post<AdminRestriction>(`/admin/users/${userId}/restrictions`, body).then((r) => r.data),

  /**
   * DELETE /admin/restrictions/:restrictionId — lift one restriction (`trust.manage`).
   *
   * Keyed by the RESTRICTION id, not the user's. The parameter is named for what it is.
   */
  liftRestriction: (restrictionId: string): Promise<AdminRestriction> =>
    api.delete<AdminRestriction>(`/admin/restrictions/${restrictionId}`).then((r) => r.data),

  /**
   * DELETE /admin/strikes/:strikeId — revoke one strike (`trust.manage`, B9/A2-2).
   *
   * Keyed by the STRIKE's id. This is the only call that lowers a user's active strike weight;
   * lifting a restriction does not (see `useLiftRestriction`). 409s a strike already revoked.
   */
  revokeStrike: (strikeId: string): Promise<AdminStrike> =>
    api.delete<AdminStrike>(`/admin/strikes/${strikeId}`).then((r) => r.data),
};
