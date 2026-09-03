import type { RecommendationItem } from '@qalam/api-types';
import { useQuery } from '@tanstack/react-query';

import { qk } from '@/lib/query-keys';
import { useAuthStore } from '@/stores/auth.store';

import { readingApi } from '../api/reading.api';
import type { PieceDetail, RelatedPiece } from '../types/reading.types';

const RELATED_STALE = 5 * 60 * 1000;

/** A related piece plus, when the recommender produced it, why it was recommended. */
export interface RelatedSuggestion extends RelatedPiece {
  /** The server's explanation. Empty for the tag-search fallback, which cannot explain itself. */
  reason: string;
}

/**
 * "More like this" (W1 §4.1, upgraded in W5) — the pieces to read next, from the best source
 * available to this reader.
 *
 * **Two sources, deliberately in this order:**
 *
 * 1. **The recommender** (`kind=related_stories&pieceId=…`) for a signed-in reader. It seeds from
 *    every tag on the piece plus its title, excludes the piece from its own results, and explains
 *    each suggestion — the `pieceId` parameter W5 implemented for exactly this
 *    ([48 §3.9](../../../../../docs/48_PlatformParityRegister.md), W5-2).
 * 2. **The tag search** otherwise, which is what W1 shipped and what a signed-out reader still gets.
 *    The recommender personalizes against the caller's own history, so it needs a session, and a
 *    public reading page's majority traffic does not have one.
 *
 * D5 removed the third condition — a `feature.ai.recommendations` flag hop. The route calls no model,
 * so there was nothing for the flag to protect; `authed` was always the condition that mattered, and
 * it is now the only one. Dropping it is what lets an anonymous reader keep the tag fallback without
 * a 401 on the way (48 §3.25).
 *
 * The fallback also catches the recommender coming back empty or failing, so the section degrades to
 * the older, dumber answer instead of disappearing. Non-critical throughout: no retries, a failure
 * renders nothing rather than an error, and the piece is filtered out of its own results defensively
 * even though the server already does it.
 */
export function useRelatedPieces(piece: PieceDetail | undefined): {
  data: RelatedSuggestion[] | undefined;
  isRecommended: boolean;
} {
  const authed = useAuthStore((s) => s.status) === 'authenticated';
  const pieceId = piece?.id ?? '';
  const canRecommend = authed && pieceId !== '';

  const recommended = useQuery({
    queryKey: qk.retrieval.recommendations('related_stories', pieceId),
    queryFn: ({ signal }) => readingApi.recommendedFor(pieceId, signal),
    enabled: canRecommend,
    staleTime: RELATED_STALE,
    retry: false,
  });

  const recItems = (recommended.data?.items ?? [])
    .filter((item) => item.targetType === 'piece')
    .map(toSuggestion)
    .filter((item) => item.id !== pieceId)
    .slice(0, 4);

  // Fall back once the recommender has actually answered (or cannot be asked) — never in parallel,
  // so a reader who gets recommendations never triggers the search request too.
  const recommenderUnusable =
    !canRecommend || recommended.isError || (recommended.isSuccess && recItems.length === 0);

  const tag = piece?.tags[0];
  const tagSearch = useQuery({
    queryKey: qk.pieces.related(pieceId, tag?.slug ?? ''),
    queryFn: ({ signal }) =>
      readingApi
        .related({ slug: tag?.slug ?? '', name: tag?.name ?? '' }, signal)
        .then((items: RelatedPiece[]) =>
          items
            .filter((item) => item.id !== pieceId)
            .slice(0, 4)
            .map((item) => ({ ...item, reason: '' })),
        ),
    enabled: recommenderUnusable && pieceId !== '' && Boolean(tag),
    staleTime: RELATED_STALE,
    retry: false,
  });

  if (recItems.length > 0) {
    return { data: recItems, isRecommended: true };
  }
  return { data: tagSearch.data, isRecommended: false };
}

/**
 * A recommendation as the reader section renders it.
 *
 * The recommender's `object` is the search-piece card the backend already returns, so the fields the
 * section needs are read from it with the item's own title/navigation as the authority. Reading time
 * and author are best-effort: an item that lacks them shows the title and its reason rather than
 * being dropped, because a suggestion with a reason is still worth offering.
 */
function toSuggestion(item: RecommendationItem): RelatedSuggestion {
  const object = item.object;
  const author = isRecord(object.author) ? object.author : {};
  return {
    id: item.id,
    slug: item.navigation.ref !== '' ? item.navigation.ref : null,
    title: item.title,
    subtitle: typeof object.subtitle === 'string' ? object.subtitle : null,
    readingTimeSeconds:
      typeof object.readingTimeSeconds === 'number' ? object.readingTimeSeconds : 0,
    author: {
      username: typeof author.username === 'string' ? author.username : '',
      penName: typeof author.penName === 'string' ? author.penName : null,
    },
    language:
      isRecord(object.language) && object.language.direction === 'rtl'
        ? { direction: 'rtl' }
        : null,
    reason: item.reason,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
