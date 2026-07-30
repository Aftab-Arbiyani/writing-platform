import { del, get, post } from '@/lib/api-client';

import type { BlockEntry, TrustSummary } from '../types/collaboration.types';

/**
 * The trust feature's `api/` layer (AF6, W3c — docs/49 §5): the viewer's own standing, and their
 * personal block/mute list.
 *
 * These routes take no permission — a user only ever acts on their own account — but they ARE
 * write-tier rate limited (`RateLimitGuard` on the controller), which is why the E2E stack runs with
 * `RATE_LIMIT_ENABLED=false` (docs/e2e/06 §6).
 *
 * **Built from the DTOs, not ported: mobile has no blocks/mutes screen at all.** Its data layer is
 * complete and wired to nothing (docs/48 §3.3), so this is the first working version of the surface
 * on any client — and the mobile client's one real defect here is instructive:
 * `BlockDto.blockedId` is the user, `id` is the relationship. Mobile read neither and fell through
 * to the row id, so unblocking always 404'd (**T-1**, `qalam-mobile/docs/56` §2.3).
 */
export const trustApi = {
  /**
   * GET /me/trust — score, level, effective status, active strike weight, active restrictions.
   *
   * The Policy Engine consumes this same status, so a wall rendered from it agrees with what the
   * server will enforce. `restrictions` contains active rows only; "lifted" is a non-null
   * `liftedAt`, not an `active` flag (T-2).
   */
  me: (signal?: AbortSignal): Promise<TrustSummary> => get<TrustSummary>('/me/trust', { signal }),

  /** GET /me/blocks — every user the viewer has blocked or muted, both kinds in one list. */
  blocks: (signal?: AbortSignal): Promise<BlockEntry[]> =>
    get<BlockEntry[]>('/me/blocks', { signal }),

  /**
   * POST /users/:id/block — severs interaction both ways.
   *
   * `userId` is the **user's** id. Never pass a {@link BlockEntry.id} here (T-1); use
   * {@link BlockEntry.blockedId}.
   */
  block: (userId: string): Promise<BlockEntry> =>
    post<BlockEntry>(`/users/${encodeURIComponent(userId)}/block`),

  /** DELETE /users/:id/block — 404s `BLOCK_NOT_FOUND` if the edge is not the viewer's. */
  unblock: (userId: string): Promise<void> => del(`/users/${encodeURIComponent(userId)}/block`),

  /** POST /users/:id/mute — hides someone from the viewer only; they are not told. */
  mute: (userId: string): Promise<BlockEntry> =>
    post<BlockEntry>(`/users/${encodeURIComponent(userId)}/mute`),

  /** DELETE /users/:id/mute */
  unmute: (userId: string): Promise<void> => del(`/users/${encodeURIComponent(userId)}/mute`),
};
