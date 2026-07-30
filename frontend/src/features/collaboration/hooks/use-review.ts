import { ERROR_CODES } from '@qalam/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { isApiError } from '@/lib/errors';
import { qk } from '@/lib/query-keys';

import { publishingApi } from '../api/publishing.api';

/**
 * The editorial review workflow for one story (AF6, W3c — docs/49 §5).
 *
 * Review gating is **opt-in per story**: a story is gated only while an open, non-approved session
 * exists. With no session at all, publish behaves exactly as it always did — which is why
 * {@link useStoryReview} resolving to `null` is the normal case, not an edge one.
 */
const REVIEW_STALE = 20 * 1000;

/**
 * The current review session, or `null` for a story that has never been submitted.
 *
 * **`null` is the Draft state, not a failure.** `GET /stories/:id/review` answers a 200 carrying
 * `{data: null}`, which is every story's state before the flow starts. Mobile's client raised
 * `API_MALFORMED_RESPONSE` on that body, so the *default* state of every story rendered as an error
 * (defect P-4, `qalam-mobile/docs/56` §2.2).
 *
 * Web needs no client change — `api-client` returns `data` untouched — so the fix is the honest
 * type: `ReviewSession | null`. React Query caches `null` happily; what it will not accept is
 * `undefined`, so a nullable resource must return `null` and never fall off the end of a function.
 */
export function useStoryReview(storyId: string | undefined) {
  return useQuery({
    queryKey: qk.stories.review(storyId ?? ''),
    queryFn: ({ signal }) => publishingApi.review(storyId ?? '', signal),
    enabled: Boolean(storyId),
    staleTime: REVIEW_STALE,
  });
}

/** True when publish was refused because an open review has not been approved. */
export function isNotApproved(error: unknown): boolean {
  return isApiError(error) && error.code === ERROR_CODES.PUBLICATION_NOT_APPROVED;
}

/**
 * Request review / approve / request changes.
 *
 * All three move the session AND the publish gate, so each invalidates the review key and the
 * capabilities map — an approval is exactly the thing that turns `publication.publish` from denied
 * into allowed, and the map is what the UI gates on.
 */
export function useReviewActions(storyId: string) {
  const client = useQueryClient();

  const invalidate = async (): Promise<void> => {
    await Promise.all([
      client.invalidateQueries({ queryKey: qk.stories.review(storyId) }),
      client.invalidateQueries({ queryKey: qk.stories.capabilities(storyId) }),
      client.invalidateQueries({ queryKey: qk.stories.history(storyId) }),
    ]);
  };

  /** No body — the handler declares no `@Body()`, so a `reviewerId` would be dropped (P-8). */
  const requestReview = useMutation({
    mutationFn: () => publishingApi.requestReview(storyId),
    onSuccess: invalidate,
  });

  const approveReview = useMutation({
    mutationFn: () => publishingApi.approveReview(storyId),
    onSuccess: invalidate,
  });

  /** `notes` — plural. The singular `note` mobile sent was never read (P-5). */
  const requestChanges = useMutation({
    mutationFn: (notes?: string) => publishingApi.requestChanges(storyId, notes),
    onSuccess: invalidate,
  });

  return { requestReview, approveReview, requestChanges };
}
