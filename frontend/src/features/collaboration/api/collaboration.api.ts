import type {
  CommentKind,
  CommentStatus,
  PresenceState,
  StoryRole,
  SuggestionStatus,
} from '@qalam/shared';

import { del, get, getPage, patch, post, type CursorPage } from '@/lib/api-client';
import { buildQueryString } from '@/lib/http';

import type {
  CollaborationComment,
  CommentAnchor,
  CommentThread,
  EditSuggestion,
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

  // ── Comments (W3b) ───────────────────────────────────────────────────────────────────────

  /**
   * GET /stories/:id/comments — **root** comments, cursor-paginated with an optional
   * open/resolved filter. Replies are NOT included: `CommentDto` has no `replies` array, so a
   * thread is its own fetch (see `thread`). Mobile assumed otherwise and never loaded any replies
   * (defect M-3, docs/48 §3.2).
   */
  comments: (
    storyId: string,
    params: { cursor?: string; status?: CommentStatus } = {},
    signal?: AbortSignal,
  ): Promise<CursorPage<CollaborationComment>> =>
    getPage<CollaborationComment>(
      `${story(storyId)}/comments${buildQueryString({ cursor: params.cursor, status: params.status })}`,
      { signal },
    ),

  /** GET /comments/:id/thread — the root comment plus its replies. */
  thread: (commentId: string, signal?: AbortSignal): Promise<CommentThread> =>
    get<CommentThread>(`/comments/${encodeURIComponent(commentId)}/thread`, { signal }),

  /**
   * POST /stories/:id/comments — a general or inline comment.
   *
   * `mentions` are **user ids**, not handles (`@IsUUID('all', {each: true})`), so a composer must
   * resolve a typed handle first — the same lesson as the invite (M-1). `parentId` is deliberately
   * absent: the create DTO rejects it, and a reply has its own endpoint.
   */
  addComment: (
    storyId: string,
    input: { body: string; kind?: CommentKind; anchor?: CommentAnchor; mentions?: string[] },
  ): Promise<CollaborationComment> =>
    post<CollaborationComment>(`${story(storyId)}/comments`, {
      body: input.body,
      ...(input.kind ? { kind: input.kind } : {}),
      ...(input.anchor ? { anchor: input.anchor } : {}),
      ...(input.mentions?.length ? { mentions: input.mentions } : {}),
    }),

  /** POST /comments/:id/replies — `{body, mentions?}` only. */
  reply: (
    commentId: string,
    input: { body: string; mentions?: string[] },
  ): Promise<CollaborationComment> =>
    post<CollaborationComment>(`/comments/${encodeURIComponent(commentId)}/replies`, {
      body: input.body,
      ...(input.mentions?.length ? { mentions: input.mentions } : {}),
    }),

  /** POST /comments/:id/resolve — closes the thread. */
  resolveComment: (commentId: string): Promise<CollaborationComment> =>
    post<CollaborationComment>(`/comments/${encodeURIComponent(commentId)}/resolve`),

  /**
   * DELETE /comments/:id — soft-delete. There is **no** edit endpoint: the contract exposes no
   * `PATCH /comments/:id`, so a comment is deleted and rewritten rather than edited.
   */
  deleteComment: (commentId: string): Promise<void> =>
    del(`/comments/${encodeURIComponent(commentId)}`),

  // ── Suggestions (W3b) ────────────────────────────────────────────────────────────────────

  /** GET /stories/:id/suggestions — cursor-paginated, optional status filter. */
  suggestions: (
    storyId: string,
    params: { cursor?: string; status?: SuggestionStatus } = {},
    signal?: AbortSignal,
  ): Promise<CursorPage<EditSuggestion>> =>
    getPage<EditSuggestion>(
      `${story(storyId)}/suggestions${buildQueryString({ cursor: params.cursor, status: params.status })}`,
      { signal },
    ),

  /**
   * POST /stories/:id/suggestions — `{anchor, originalText, suggestedText}`.
   *
   * `anchor` is **required**. Mobile omitted it and sent `blockId`/`rationale` instead, which the
   * DTO rejects, so its create could only ever 400 (defect M-2, docs/48 §3.2).
   */
  addSuggestion: (
    storyId: string,
    input: { anchor: { from: number; to: number }; originalText: string; suggestedText: string },
  ): Promise<EditSuggestion> => post<EditSuggestion>(`${story(storyId)}/suggestions`, input),

  /**
   * POST /suggestions/:id/accept — applies the edit and records the decision.
   *
   * It **does** rewrite the prose (since `f6827e0`): the service replaces the anchored range of the
   * piece body with `suggestedText` in the same transaction that marks the suggestion accepted,
   * capturing a `pre_edit` snapshot first. A stale anchor is `409 SUGGESTION_CONFLICT` and writes
   * nothing. Callers must therefore refresh the piece read, not just the suggestions list.
   */
  acceptSuggestion: (suggestionId: string): Promise<EditSuggestion> =>
    post<EditSuggestion>(`/suggestions/${encodeURIComponent(suggestionId)}/accept`),

  /** POST /suggestions/:id/reject — resolver declines it. */
  rejectSuggestion: (suggestionId: string): Promise<EditSuggestion> =>
    post<EditSuggestion>(`/suggestions/${encodeURIComponent(suggestionId)}/reject`),

  /** POST /suggestions/:id/withdraw — the author takes it back. */
  withdrawSuggestion: (suggestionId: string): Promise<EditSuggestion> =>
    post<EditSuggestion>(`/suggestions/${encodeURIComponent(suggestionId)}/withdraw`),
};
