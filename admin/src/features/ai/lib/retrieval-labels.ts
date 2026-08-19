import {
  RankingSignal,
  RetrievalFailureReason,
  RetrievalIntent,
  RetrievalQueryType,
  RetrievalSource,
  RETRIEVAL_SOURCE_ORDER,
} from '@qalam/shared';
import type { SearchAnalytics } from '@qalam/api-types';

/**
 * Operator-facing names for the retrieval enums, plus the emptiness rule for the analytics read
 * (A3). Kept out of the pages so both surfaces name a signal the same way, and so the mapping is
 * unit-testable without rendering.
 *
 * Every map is declared `satisfies Record<Enum, string>`, so adding a source, signal, intent,
 * query type or failure reason to `@qalam/shared` fails the build here instead of rendering a raw
 * `snake_case` token to an admin.
 */

export const SOURCE_LABELS = {
  [RetrievalSource.KnowledgeGraph]: 'Knowledge graph',
  [RetrievalSource.Metadata]: 'Metadata',
  [RetrievalSource.Keyword]: 'Keyword',
  [RetrievalSource.Vector]: 'Vector',
} satisfies Record<RetrievalSource, string>;

export const SOURCE_HINTS = {
  [RetrievalSource.KnowledgeGraph]: 'The story graph (AF3) — the source of truth for entities.',
  [RetrievalSource.Metadata]: 'Title, tags, genre, language, chapters.',
  [RetrievalSource.Keyword]: 'Lexical full-text and trigram search.',
  [RetrievalSource.Vector]:
    'Reserved extension point. Its retriever reports itself unavailable until an embedding backend exists, so this toggle changes nothing today.',
} satisfies Record<RetrievalSource, string>;

/** Sources in the planner's own execution order, so the form reads like the pipeline runs. */
export const SOURCE_ORDER: readonly RetrievalSource[] = RETRIEVAL_SOURCE_ORDER;

export const SIGNAL_LABELS = {
  [RankingSignal.SemanticSimilarity]: 'Semantic similarity',
  [RankingSignal.GraphDistance]: 'Graph distance',
  [RankingSignal.Popularity]: 'Popularity',
  [RankingSignal.Freshness]: 'Freshness',
  [RankingSignal.UserPreferences]: 'User preferences',
  [RankingSignal.ReadingHistory]: 'Reading history',
  [RankingSignal.WritingHistory]: 'Writing history',
  [RankingSignal.Engagement]: 'Engagement',
  [RankingSignal.Confidence]: 'Confidence',
} satisfies Record<RankingSignal, string>;

export const INTENT_LABELS = {
  [RetrievalIntent.Search]: 'Search',
  [RetrievalIntent.Ask]: 'Ask My Book',
  [RetrievalIntent.Explore]: 'Story Explorer',
  [RetrievalIntent.Recommend]: 'Recommendations',
  [RetrievalIntent.Navigate]: 'Navigate',
} satisfies Record<RetrievalIntent, string>;

export const QUERY_TYPE_LABELS = {
  [RetrievalQueryType.NaturalLanguage]: 'Natural language',
  [RetrievalQueryType.Character]: 'Character',
  [RetrievalQueryType.Scene]: 'Scene',
  [RetrievalQueryType.Chapter]: 'Chapter',
  [RetrievalQueryType.Location]: 'Location',
  [RetrievalQueryType.Timeline]: 'Timeline',
  [RetrievalQueryType.Event]: 'Event',
  [RetrievalQueryType.Relationship]: 'Relationship',
  [RetrievalQueryType.Dialogue]: 'Dialogue',
  [RetrievalQueryType.Quote]: 'Quote',
  [RetrievalQueryType.Concept]: 'Concept',
  [RetrievalQueryType.WorldBuilding]: 'World building',
} satisfies Record<RetrievalQueryType, string>;

export const FAILURE_LABELS = {
  [RetrievalFailureReason.NoResults]: 'No results',
  [RetrievalFailureReason.Timeout]: 'Timed out',
  [RetrievalFailureReason.RetrievalFailure]: 'Retrieval failed',
  [RetrievalFailureReason.ProviderFailure]: 'Provider failed',
  [RetrievalFailureReason.ContextTooLarge]: 'Context too large',
  [RetrievalFailureReason.QuotaExceeded]: 'Quota exceeded',
  [RetrievalFailureReason.NetworkFailure]: 'Network failure',
} satisfies Record<RetrievalFailureReason, string>;

/**
 * A window with no requests in it. Every other figure is derived from the same rows, so they are
 * all a true zero — and a page of zeroes reads as a measurement rather than an absence, which is
 * the W7c defect. One check on the count decides the whole page.
 */
export function searchAnalyticsIsEmpty(analytics: SearchAnalytics): boolean {
  return analytics.totalQueries === 0;
}

export const EMPTY_COPY = {
  title: 'No AI retrieval requests in this window',
  description:
    'Search, Ask My Book and recommendation requests are logged as they happen. Nothing has been recorded in the selected window — try a longer one, or check that the AI feature flags are on.',
} as const;

/** A 0..1 rate as a percentage, for reading rather than for arithmetic. */
export function asPercent(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}
