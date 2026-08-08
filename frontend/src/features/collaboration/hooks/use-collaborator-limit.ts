import { useQuery } from '@tanstack/react-query';

import { qk } from '@/lib/query-keys';

import { collaborationApi } from '../api/collaboration.api';

/**
 * A story's collaborator seat allowance (B6, docs/45 §4.11) —
 * `GET /stories/:id/collaborators/limit`.
 *
 * Server-authoritative, like every other entitlement read: the client shows the number and the
 * server decides. The route is authorized as `story.invite`, so a viewer who cannot invite gets a
 * 403 — hence `enabled`, which lets the caller withhold the request rather than render an error
 * next to a control that viewer was never going to see.
 *
 * The key sits under the `['stories', id]` prefix, so the membership and invitation mutations that
 * already invalidate that prefix move this count too.
 */
export function useCollaboratorLimit(storyId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: qk.stories.collaboratorLimit(storyId ?? ''),
    queryFn: ({ signal }) => collaborationApi.collaboratorLimit(storyId ?? '', signal),
    enabled: Boolean(storyId) && enabled,
    staleTime: 30_000,
    // A 403 here means "not your seat count to see", and retrying will not change that answer.
    retry: false,
  });
}
