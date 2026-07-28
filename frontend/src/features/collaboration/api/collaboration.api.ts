import type { PresenceState, StoryRole } from '@qalam/shared';

import { del, get, patch, post } from '@/lib/api-client';

import type {
  StoryCapabilities,
  StoryInvitation,
  StoryMember,
  StoryPresence,
} from '../types/collaboration.types';

/**
 * The collaboration feature's `api/` layer (AF6, W3a) — the only place these routes are named
 * (docs/32 §10). Every one of them is additive AF6 surface; the frozen `v1` contract is untouched.
 *
 * A "story" IS a piece: `storyId === pieceId` (docs/38 §3).
 */
const story = (id: string): string => `/stories/${encodeURIComponent(id)}`;

export const collaborationApi = {
  // ── Capabilities — the decision map every affordance reflects ────────────────────────────

  /**
   * GET /stories/:id/capabilities — the Policy Engine's per-action verdict for this viewer.
   * The client reflects these; it never re-derives authorization (docs/38 §2, docs/49 §3).
   */
  capabilities: (storyId: string, signal?: AbortSignal): Promise<StoryCapabilities> =>
    get<StoryCapabilities>(`${story(storyId)}/capabilities`, { signal }),

  // ── Members ──────────────────────────────────────────────────────────────────────────────

  /** GET /stories/:id/members — includes the owner, synthesised from the piece author. */
  members: (storyId: string, signal?: AbortSignal): Promise<StoryMember[]> =>
    get<StoryMember[]>(`${story(storyId)}/members`, { signal }),

  /**
   * POST /stories/:id/members — add a collaborator directly (no invitation round-trip).
   * Takes `userId`, unlike the invite below which takes `inviteeId` — the two request DTOs
   * genuinely differ, so this asymmetry is the contract's, not a typo.
   */
  addMember: (storyId: string, userId: string, role: StoryRole): Promise<StoryMember> =>
    post<StoryMember>(`${story(storyId)}/members`, { userId, role }),

  /** PATCH /stories/:id/members/:userId — change a collaborator's role (never to `owner`). */
  changeRole: (storyId: string, userId: string, role: StoryRole): Promise<StoryMember> =>
    patch<StoryMember>(`${story(storyId)}/members/${encodeURIComponent(userId)}`, { role }),

  /** DELETE /stories/:id/members/:userId — remove a collaborator. */
  removeMember: (storyId: string, userId: string): Promise<void> =>
    del(`${story(storyId)}/members/${encodeURIComponent(userId)}`),

  /** POST /stories/:id/leave — the viewer removes themselves. */
  leave: (storyId: string): Promise<void> => post(`${story(storyId)}/leave`),

  // ── Invitations ──────────────────────────────────────────────────────────────────────────

  /**
   * POST /stories/:id/invitations — invite by **user id**.
   *
   * The contract requires `{ inviteeId, role }` and the app runs
   * `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })`, so an email or a
   * `userId` key is rejected outright. That is exactly the mobile defect **M-1**
   * (docs/48 §3.1) — the caller resolves a handle to an id first (`useResolveHandle`).
   */
  invite: (storyId: string, inviteeId: string, role: StoryRole): Promise<StoryInvitation> =>
    post<StoryInvitation>(`${story(storyId)}/invitations`, { inviteeId, role }),

  /** GET /stories/:id/invitations — outstanding invitations for this story. */
  storyInvitations: (storyId: string, signal?: AbortSignal): Promise<StoryInvitation[]> =>
    get<StoryInvitation[]>(`${story(storyId)}/invitations`, { signal }),

  /**
   * GET /me/invitations — the viewer's own inbox, across every story.
   *
   * **Pending only.** The endpoint filters to `InvitationStatus.Pending`
   * (`invitation.service.ts#listMine`), so an accepted or declined invitation simply stops being
   * returned. There is no "history of invitations I answered" to render from this route.
   */
  myInvitations: (signal?: AbortSignal): Promise<StoryInvitation[]> =>
    get<StoryInvitation[]>('/me/invitations', { signal }),

  /**
   * POST /invitations/:id/accept — acceptance creates the membership server-side.
   *
   * Returns the new **member**, not the invitation (`MemberDto`), so the response carries no
   * `storyId`; a caller that needs to invalidate story-scoped caches must remember which story it
   * was answering. `decline` and `revoke` do return the invitation.
   */
  accept: (invitationId: string): Promise<StoryMember> =>
    post<StoryMember>(`/invitations/${encodeURIComponent(invitationId)}/accept`),

  /** POST /invitations/:id/decline */
  decline: (invitationId: string): Promise<StoryInvitation> =>
    post<StoryInvitation>(`/invitations/${encodeURIComponent(invitationId)}/decline`),

  /** DELETE /invitations/:id — the inviter revokes a pending invitation. */
  revoke: (invitationId: string): Promise<void> =>
    del(`/invitations/${encodeURIComponent(invitationId)}`),

  // ── Presence (polled — the backend has no websocket layer, docs/49 §6) ───────────────────

  /** GET /stories/:id/presence — who is currently in the workspace. */
  presence: (storyId: string, signal?: AbortSignal): Promise<StoryPresence[]> =>
    get<StoryPresence[]>(`${story(storyId)}/presence`, { signal }),

  /** POST /stories/:id/presence — heartbeat. Best-effort; a lost beat only ages the roster. */
  heartbeat: (storyId: string, state: PresenceState): Promise<void> =>
    post(`${story(storyId)}/presence`, { state }),
};
