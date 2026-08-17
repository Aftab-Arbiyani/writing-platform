import { api } from '@/lib/api-client';

import type {
  AdminRestriction,
  AdminStrike,
  AdminTrustSummary,
  ApplyRestrictionPayload,
  IssueStrikePayload,
} from '../types/trust.types';

/**
 * The Trust admin surface's `api/` layer (AF6, row A2) — the ONLY place the five
 * `trust.admin.controller.ts` paths are named. Everything goes through the shared
 * `api-client` (Bearer + envelope-unwrap + single-flight refresh).
 *
 * **Four of the five routes are keyed by USER id; `lift` is keyed by RESTRICTION id.**
 * `DELETE /admin/restrictions/:id` takes the restriction's own id — the asymmetry is in the
 * controller (`trust.admin.controller.ts:96`), so it is named here once, loudly, rather than
 * left for a caller to get wrong. Both are UUIDs, so the wrong one 404s instead of failing
 * to compile.
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
};
