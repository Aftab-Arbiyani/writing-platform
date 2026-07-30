import { useQuery } from '@tanstack/react-query';

import { isApiError } from '@/lib/errors';
import { qk } from '@/lib/query-keys';

import { readingApi } from '../api/reading.api';

/**
 * The reading view's queries (W1, docs/45 §4.1).
 *
 * A published piece is immutable in practice — the body only changes when its author edits it —
 * so the content tier gets a long `staleTime` (docs/12 §2.2): re-reading a piece you just opened
 * should never re-fetch. Engagement is the opposite: counts move while you read, so it carries a
 * short one and is a separate query, letting the article render without waiting on it.
 */
const CONTENT_STALE = 5 * 60 * 1000;
const ENGAGEMENT_STALE = 30 * 1000;

/** Retrying a 404 is pointless and delays the not-found state — fail fast on it. */
function retryUnlessNotFound(failureCount: number, error: unknown): boolean {
  if (isApiError(error) && error.status === 404) {
    return false;
  }
  return failureCount < 2;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The piece itself, addressed by whatever `/p/:slug` carried.
 *
 * Usually that is a slug. But `piecePath()` falls back to the **id** when a piece has no slug
 * yet — an unpublished draft, which only its author can open — and the by-slug endpoint would
 * 404 on a UUID. So the identifier is sniffed and dispatched to the matching endpoint. The two
 * return the identical DTO under identical visibility rules, so callers cannot tell which ran.
 */
export function usePiece(idOrSlug: string | undefined) {
  const isId = idOrSlug !== undefined && UUID.test(idOrSlug);
  return useQuery({
    queryKey: isId ? qk.pieces.detail(idOrSlug) : qk.pieces.bySlug(idOrSlug ?? ''),
    queryFn: ({ signal }) =>
      isId ? readingApi.byId(idOrSlug, signal) : readingApi.bySlug(idOrSlug ?? '', signal),
    enabled: Boolean(idOrSlug),
    staleTime: CONTENT_STALE,
    retry: retryUnlessNotFound,
  });
}

/**
 * Engagement counts for a piece. Gated on the id, which only exists once the piece query has
 * resolved — so this fires as a second wave rather than blocking the article.
 */
export function usePieceEngagement(pieceId: string | undefined) {
  return useQuery({
    queryKey: qk.pieces.engagement(pieceId ?? ''),
    queryFn: ({ signal }) => readingApi.engagement(pieceId ?? '', signal),
    enabled: Boolean(pieceId),
    staleTime: ENGAGEMENT_STALE,
  });
}
