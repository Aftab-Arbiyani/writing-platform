import type { Visibility } from '@qalam/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { qk } from '@/lib/query-keys';

import { publishingApi } from '../api/publishing.api';

/**
 * A story's publication state and its history (AF6, W3c — docs/49 §5).
 *
 * Every action here answers the **piece** in its new state (`PieceResponseDto`), so each one moves
 * caches that live outside this feature: the piece the editor and reader render, and the viewer's
 * own draft list. That is why these mutations invalidate `qk.pieces` as well as the story keys —
 * publishing from this page and then opening the editor must not show a stale status.
 */
const HISTORY_STALE = 30 * 1000;

/** The immutable publishing history, newest first. */
export function useStoryHistory(storyId: string | undefined) {
  return useQuery({
    queryKey: qk.stories.history(storyId ?? ''),
    queryFn: ({ signal }) => publishingApi.history(storyId ?? '', signal),
    enabled: Boolean(storyId),
    staleTime: HISTORY_STALE,
  });
}

/**
 * Publish / unpublish / schedule / change visibility.
 *
 * None of the four is optimistic. Publish can be refused outright
 * (`PUBLICATION_NOT_APPROVED` while a review is open), schedule can be refused for a past instant,
 * and flipping a status chip forward and then back would tell the writer their story went live when
 * it did not.
 */
export function usePublicationActions(storyId: string) {
  const client = useQueryClient();

  /**
   * A publication action changes the story's editorial state AND the piece itself, so both
   * namespaces go. `qk.pieces.all` rather than `detail(storyId)`: the reader is slug-keyed
   * (`qk.pieces.bySlug`) and there is no slug in scope here — the prefix covers both views, which
   * is what `query-keys.ts` documents it for.
   */
  const invalidate = async (): Promise<void> => {
    await Promise.all([
      client.invalidateQueries({ queryKey: qk.stories.history(storyId) }),
      client.invalidateQueries({ queryKey: qk.stories.review(storyId) }),
      client.invalidateQueries({ queryKey: qk.stories.capabilities(storyId) }),
      client.invalidateQueries({ queryKey: qk.pieces.all }),
      client.invalidateQueries({ queryKey: qk.me.all }),
    ]);
  };

  const publish = useMutation({
    mutationFn: () => publishingApi.publish(storyId),
    onSuccess: invalidate,
  });

  const unpublish = useMutation({
    mutationFn: () => publishingApi.unpublish(storyId),
    onSuccess: invalidate,
  });

  /** `scheduledAt` — an ISO instant. `scheduledFor` is not a key the DTO accepts (P-2). */
  const schedule = useMutation({
    mutationFn: (scheduledAt: string) => publishingApi.schedule(storyId, scheduledAt),
    onSuccess: invalidate,
  });

  /** `public | unlisted | private` only — there is no `followers` (P-3). */
  const changeVisibility = useMutation({
    mutationFn: (visibility: Visibility) => publishingApi.changeVisibility(storyId, visibility),
    onSuccess: invalidate,
  });

  return { publish, unpublish, schedule, changeVisibility };
}
