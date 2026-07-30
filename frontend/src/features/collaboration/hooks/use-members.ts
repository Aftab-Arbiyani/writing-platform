import type { StoryRole } from '@qalam/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { qk } from '@/lib/query-keys';

import { collaborationApi } from '../api/collaboration.api';

/**
 * Story membership (AF6, W3a — docs/49 §5). Reads the roster; mutations are **not** optimistic.
 *
 * Membership is authorization-adjacent: a role change alters what the server will accept next, so
 * showing a new role before the server has agreed would mean rendering permissions the viewer may
 * not have. Every mutation therefore settles first, then invalidates — including the capability
 * map, because changing your own role changes your own affordances.
 */
const MEMBERS_STALE = 60 * 1000;

export function useStoryMembers(storyId: string | undefined) {
  return useQuery({
    queryKey: qk.stories.members(storyId ?? ''),
    queryFn: ({ signal }) => collaborationApi.members(storyId ?? '', signal),
    enabled: Boolean(storyId),
    staleTime: MEMBERS_STALE,
  });
}

export function useMemberActions(storyId: string) {
  const client = useQueryClient();

  /**
   * Invalidate the whole story prefix, not just the member list: a membership change can move
   * the viewer's capabilities, the presence roster, and the outstanding invitations at once.
   */
  const invalidateStory = async (): Promise<void> => {
    await client.invalidateQueries({ queryKey: qk.stories.detail(storyId) });
  };

  const changeRole = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: StoryRole }) =>
      collaborationApi.changeRole(storyId, userId, role),
    onSuccess: invalidateStory,
  });

  const removeMember = useMutation({
    mutationFn: (userId: string) => collaborationApi.removeMember(storyId, userId),
    onSuccess: invalidateStory,
  });

  const leave = useMutation({
    mutationFn: () => collaborationApi.leave(storyId),
    onSuccess: invalidateStory,
  });

  return { changeRole, removeMember, leave };
}
