import type { RecommendationKind } from '@qalam/shared';

import type {
  RecommendationItemDto,
  RetrievalResponseMetaDto,
  SearchResultItemDto,
} from './dto/retrieval-response.dto';
import type { RankedCandidate, RetrievalResult } from './retrieval.types';

/** RankedCandidate → search result item (structured object + evidence + explanation). */
export function toSearchResultItem(c: RankedCandidate): SearchResultItemDto {
  return {
    id: c.id,
    type: c.type,
    sourceType: c.source,
    title: c.title,
    summary: c.summary,
    object: c.object,
    confidence: c.confidence,
    relevanceScore: c.score,
    evidence: c.evidence,
    relatedEntities: c.related,
    navigation: c.navigation,
    reason: c.ranking.summary,
    ranking: c.ranking,
  };
}

/** RankedCandidate → recommendation item (always carries a reason + influencing entities). */
export function toRecommendationItem(
  c: RankedCandidate,
  kind: RecommendationKind,
): RecommendationItemDto {
  return {
    id: c.id,
    kind,
    targetType: c.type,
    title: c.title,
    summary: c.summary,
    object: c.object,
    score: c.score,
    confidence: c.confidence,
    reason: c.ranking.summary,
    influencedBy: c.related,
    evidence: c.evidence,
    navigation: c.navigation,
  };
}

/** RetrievalResult telemetry → response meta (what a client sees; internals stay in logs). */
export function toResponseMeta(result: RetrievalResult): RetrievalResponseMetaDto {
  const t = result.telemetry;
  return {
    sources: t.sources.filter((s) => s.ok).map((s) => s.source),
    totalCandidates: t.totalCandidates,
    returned: t.returned,
    confidence: t.confidence,
    degraded: t.degraded,
    ...(t.failureReason !== null ? { failureReason: t.failureReason } : {}),
  };
}
