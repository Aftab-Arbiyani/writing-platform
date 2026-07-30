import type { StoryRole } from '@qalam/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { get } from '@/lib/api-client';
import { qk } from '@/lib/query-keys';
import type { ProfileResponse } from '@/types/profile';

import { collaborationApi } from '../api/collaboration.api';

/**
 * Story invitations (AF6, W3a — docs/49 §5): the per-story list, the viewer's own inbox, and the
 * handle → id resolution that makes inviting possible at all.
 */
const INVITATIONS_STALE = 30 * 1000;

/** Outstanding invitations for one story (owner/co-author view). */
export function useStoryInvitations(storyId: string | undefined) {
  return useQuery({
    queryKey: qk.stories.invitations(storyId ?? ''),
    queryFn: ({ signal }) => collaborationApi.storyInvitations(storyId ?? '', signal),
    enabled: Boolean(storyId),
    staleTime: INVITATIONS_STALE,
  });
}

/**
 * The viewer's invitation inbox, across every story (`/me/invitations`).
 *
 * `enabled` exists so the dark-launch flag can stop the **request**, not just hide the list — a
 * kill switch that still talks to the server is not a kill switch (docs/49 §2.2).
 */
export function useMyInvitations(enabled = true) {
  return useQuery({
    queryKey: qk.invitations.mine(),
    queryFn: ({ signal }) => collaborationApi.myInvitations(signal),
    enabled,
    staleTime: INVITATIONS_STALE,
  });
}

/**
 * Resolve a typed `@handle` to the user id the invite contract requires.
 *
 * This exists because `POST /stories/:id/invitations` takes `inviteeId` (a UUID) and there is no
 * invite-by-email path anywhere in the backend — the assumption that broke mobile's invite
 * (**M-1**, docs/48 §3.1). `GET /users/:username` already returns `id`, and the reader's author
 * card resolves a follow target the same way, so this reuses an established lookup rather than
 * adding a mechanism.
 *
 * Shares `qk.profiles.detail` with `useProfile`, so a handle already on screen resolves from cache
 * with no extra request. A leading `@` is tolerated because people type it.
 */
export function useResolveHandle(handle: string) {
  const username = handle.trim().replace(/^@+/, '');
  return useQuery({
    queryKey: qk.profiles.detail(username),
    queryFn: ({ signal }) =>
      get<ProfileResponse>(`/users/${encodeURIComponent(username)}`, { signal }),
    enabled: username.length > 0,
    staleTime: 60_000,
    // A typo is the common case here, and retrying a 404 only delays telling the user so.
    retry: false,
  });
}

export function useInvitationActions(storyId?: string) {
  const client = useQueryClient();

  /** Accepting creates a membership, so the story's roster and capabilities both move. */
  const invalidateAfterResponse = async (respondedStoryId: string): Promise<void> => {
    await Promise.all([
      client.invalidateQueries({ queryKey: qk.invitations.mine() }),
      client.invalidateQueries({ queryKey: qk.stories.detail(respondedStoryId) }),
    ]);
  };

  const invite = useMutation({
    mutationFn: ({ inviteeId, role }: { inviteeId: string; role: StoryRole }) =>
      collaborationApi.invite(storyId ?? '', inviteeId, role),
    onSuccess: async () => {
      if (storyId) {
        await client.invalidateQueries({ queryKey: qk.stories.invitations(storyId) });
      }
    },
  });

  /**
   * Accept takes the story id as a VARIABLE rather than reading it off the response: the endpoint
   * answers with the new `MemberDto`, which has no `storyId` (docs/49 §5). Passing it in is what
   * lets the story's roster and capability map be invalidated too — accepting makes the viewer a
   * member, so both change.
   */
  const accept = useMutation({
    mutationFn: ({ invitationId }: { invitationId: string; storyId: string }) =>
      collaborationApi.accept(invitationId),
    onSuccess: (_member, variables) => invalidateAfterResponse(variables.storyId),
  });

  const decline = useMutation({
    mutationFn: (invitationId: string) => collaborationApi.decline(invitationId),
    // Decline DOES return the invitation, so the story id comes off the response.
    onSuccess: (invitation) => invalidateAfterResponse(invitation.storyId),
  });

  const revoke = useMutation({
    mutationFn: (invitationId: string) => collaborationApi.revoke(invitationId),
    onSuccess: async () => {
      if (storyId) {
        await client.invalidateQueries({ queryKey: qk.stories.invitations(storyId) });
      }
    },
  });

  return { invite, accept, decline, revoke };
}
