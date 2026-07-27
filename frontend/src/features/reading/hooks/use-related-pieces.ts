import { useQuery } from '@tanstack/react-query';

import { qk } from '@/lib/query-keys';

import { readingApi } from '../api/reading.api';
import type { PieceDetail, RelatedPiece } from '../types/reading.types';

const RELATED_STALE = 5 * 60 * 1000;

/**
 * "More like this" (W1, docs/45 §4.1) — pieces sharing this one's first tag.
 *
 * Non-critical, and treated as such: it is disabled entirely for an untagged piece, a failure
 * renders nothing rather than an error, and the current piece is filtered out of its own
 * results. See `readingApi.related` for why this is a tag search rather than a recommender.
 */
export function useRelatedPieces(piece: PieceDetail | undefined) {
  const tag = piece?.tags[0];
  return useQuery({
    queryKey: qk.pieces.related(piece?.id ?? '', tag?.slug ?? ''),
    queryFn: ({ signal }) =>
      readingApi
        .related({ slug: tag?.slug ?? '', name: tag?.name ?? '' }, signal)
        .then((items: RelatedPiece[]) => items.filter((item) => item.id !== piece?.id).slice(0, 4)),
    enabled: Boolean(piece?.id) && Boolean(tag),
    staleTime: RELATED_STALE,
    retry: false,
  });
}
