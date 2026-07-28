import type {
  InvitationStatus,
  PolicyActionCode,
  PolicyEffect,
  PolicyObligation,
  PresenceState,
  StoryRole,
} from '@qalam/shared';

/**
 * Wire types for the collaboration surface (AF6, W3a — docs/49 §4). One-to-one with the
 * backend DTOs in `collaboration-response.dto.ts`.
 *
 * The **vocabulary** (`StoryRole`, `PolicyEffect`, `InvitationStatus`, …) is imported from
 * `@qalam/shared` and never re-declared here — the wire is authoritative, and a second copy of
 * a role list is a second thing to get out of step with the server.
 */

/**
 * A collaborator on a story. Note what is NOT here: no username, pen name, or avatar — the
 * server returns **ids only**, so any human-readable label is resolved separately through the
 * profile lookup. Mobile hit the same wall (its `StoryMember.label` falls back to the raw id).
 */
export interface StoryMember {
  userId: string;
  role: StoryRole;
  invitedById: string | null;
  /** Join time; `null` for the owner, who is synthesised from the piece author (no row). */
  joinedAt: string | null;
}

export interface StoryInvitation {
  id: string;
  storyId: string;
  inviterId: string;
  inviteeId: string;
  role: StoryRole;
  status: InvitationStatus;
  expiresAt: string;
  respondedAt: string | null;
  createdAt: string;
}

/** A collaborator's live presence in the story workspace (polled, not pushed — docs/49 §6). */
export interface StoryPresence {
  userId: string;
  state: PresenceState;
  lastSeenAt: string;
}

/**
 * One Policy Engine decision the client **reflects**. `allowed` is the server's answer; the
 * client never recomputes it from a role, an ownership check, or a trust level (docs/49 §3).
 * `reason` is a machine code suitable for branching, and `obligations` carry conditions of a
 * `conditional_access` decision (e.g. `shadow_only`).
 */
export interface StoryCapability {
  action: PolicyActionCode | string;
  effect: PolicyEffect;
  allowed: boolean;
  reason: string;
  obligations: PolicyObligation[];
}

export interface StoryCapabilities {
  storyId: string;
  capabilities: StoryCapability[];
}
