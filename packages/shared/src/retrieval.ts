/**
 * Retrieval Platform vocabulary (AF4 — AI Discovery / Search / Recommendation).
 *
 * The provider-agnostic domain language for the reusable **Retrieval Platform**: the
 * single entry point every AI feature routes through (intent → classification →
 * planning → retrieval → context assembly → LLM → grounded response). Like the rest of
 * `@qalam/shared` this is zero-dependency pure vocabulary — `as const` objects + derived
 * union types (JSON-safe wire strings) + pure helpers + guardrail constants.
 *
 * Design law (docs/36): the Knowledge Graph owns structured knowledge, Retrieval owns
 * context, the LLM owns explanation, presentation owns rendering. Sets are deliberately
 * OPEN (varchar + this catalogue) so a new query type / source / ranking signal never
 * needs a migration, and future sources (vectors, cross-book, federated) slot in behind
 * the same vocabulary.
 */

import { AiFeature } from './ai.js';

// ── Intent & classification (the front of the pipeline) ─────────────────────────

/** The high-level thing the user is trying to do. Drives the retrieval plan. */
export const RetrievalIntent = {
  /** Find matching entities/passages ("semantic search"). */
  Search: 'search',
  /** Ask a grounded question and get a cited answer ("Ask My Book"). */
  Ask: 'ask',
  /** Browse structured graph views ("Story Explorer"). */
  Explore: 'explore',
  /** Get ranked suggestions ("Recommendation Engine"). */
  Recommend: 'recommend',
  /** Jump straight to a known entity ("navigate"). */
  Navigate: 'navigate',
} as const;
export type RetrievalIntent = (typeof RetrievalIntent)[keyof typeof RetrievalIntent];

/**
 * Query classification — what KIND of thing the query is about. This is the
 * Semantic Search taxonomy (natural-language + the entity/passage facets) and it
 * biases which retrieval strategies and graph node types are prioritised.
 */
export const RetrievalQueryType = {
  NaturalLanguage: 'natural_language',
  Character: 'character',
  Scene: 'scene',
  Chapter: 'chapter',
  Location: 'location',
  Timeline: 'timeline',
  Event: 'event',
  Relationship: 'relationship',
  Dialogue: 'dialogue',
  Quote: 'quote',
  Concept: 'concept',
  WorldBuilding: 'world_building',
} as const;
export type RetrievalQueryType = (typeof RetrievalQueryType)[keyof typeof RetrievalQueryType];

// ── Retrieval sources (the strategies the planner composes) ─────────────────────

/**
 * A retrieval strategy. Each maps to one pluggable `Retriever` registered under the
 * `RETRIEVERS` token. `vector` is a reserved EXTENSION POINT — no `pgvector`/embedding
 * store exists yet, so its retriever is registered but inert (returns nothing + reports
 * unavailable) until a vector backend lands, with zero pipeline change.
 */
export const RetrievalSource = {
  /** The story knowledge graph (AF3) — the single source of truth. */
  KnowledgeGraph: 'knowledge_graph',
  /** Structured metadata (title/tags/genre/language/chapters). */
  Metadata: 'metadata',
  /** Lexical full-text/trigram search (reuses the E8 SearchService seam). */
  Keyword: 'keyword',
  /** Dense/vector retrieval — reserved extension point (inert until a store exists). */
  Vector: 'vector',
} as const;
export type RetrievalSource = (typeof RetrievalSource)[keyof typeof RetrievalSource];

/** All sources in canonical execution/priority order (graph first — it is the SSOT). */
export const RETRIEVAL_SOURCE_ORDER: readonly RetrievalSource[] = [
  RetrievalSource.KnowledgeGraph,
  RetrievalSource.Metadata,
  RetrievalSource.Keyword,
  RetrievalSource.Vector,
];

// ── Ranking (how candidates are ordered) ────────────────────────────────────────

/** The signals a ranking strategy can combine into a final score + explanation. */
export const RankingSignal = {
  SemanticSimilarity: 'semantic_similarity',
  GraphDistance: 'graph_distance',
  Popularity: 'popularity',
  Freshness: 'freshness',
  UserPreferences: 'user_preferences',
  ReadingHistory: 'reading_history',
  WritingHistory: 'writing_history',
  Engagement: 'engagement',
  Confidence: 'confidence',
} as const;
export type RankingSignal = (typeof RankingSignal)[keyof typeof RankingSignal];

// ── Ask My Book (grounded Q&A scopes) ───────────────────────────────────────────

/** What slice of the story an "Ask" is grounded against. */
export const AskScope = {
  Book: 'book',
  Chapter: 'chapter',
  Scene: 'scene',
  Character: 'character',
  Timeline: 'timeline',
  Relationship: 'relationship',
  World: 'world',
  Theme: 'theme',
  Lore: 'lore',
} as const;
export type AskScope = (typeof AskScope)[keyof typeof AskScope];

// ── Story Explorer (structured graph views) ─────────────────────────────────────

/** A structured view over the story knowledge graph. Every view renders from graph objects. */
export const ExplorerView = {
  Characters: 'characters',
  Relationships: 'relationships',
  Timeline: 'timeline',
  Locations: 'locations',
  Events: 'events',
  Objects: 'objects',
  Concepts: 'concepts',
  /** The whole graph as a navigable map (nodes + edges). */
  Map: 'map',
} as const;
export type ExplorerView = (typeof ExplorerView)[keyof typeof ExplorerView];

// ── Recommendation Engine ───────────────────────────────────────────────────────

/** A recommendation surface. Each reuses existing feed/search/graph signals — never a new stack. */
export const RecommendationKind = {
  RelatedStories: 'related_stories',
  RelatedChapters: 'related_chapters',
  RelatedCharacters: 'related_characters',
  RelatedTopics: 'related_topics',
  ContinueReading: 'continue_reading',
  Authors: 'authors',
  Genres: 'genres',
  Collections: 'collections',
  Feed: 'feed',
  Trending: 'trending',
} as const;
export type RecommendationKind = (typeof RecommendationKind)[keyof typeof RecommendationKind];

// ── Failure classification (observability + graceful recovery) ──────────────────

/** How a retrieval request failed — captured for telemetry, never leaked to end users. */
export const RetrievalFailureReason = {
  NoResults: 'no_results',
  Timeout: 'timeout',
  RetrievalFailure: 'retrieval_failure',
  ProviderFailure: 'provider_failure',
  ContextTooLarge: 'context_too_large',
  QuotaExceeded: 'quota_exceeded',
  NetworkFailure: 'network_failure',
} as const;
export type RetrievalFailureReason =
  (typeof RetrievalFailureReason)[keyof typeof RetrievalFailureReason];

// ── Pure helpers ────────────────────────────────────────────────────────────────

/** Which AiFeature (and therefore which flag) gates a retrieval intent that hits the LLM. */
export function retrievalIntentFeature(intent: RetrievalIntent): AiFeature {
  switch (intent) {
    case RetrievalIntent.Ask:
      return AiFeature.AskBook;
    case RetrievalIntent.Recommend:
      return AiFeature.Recommendations;
    default:
      return AiFeature.SemanticSearch;
  }
}

/** The server prompt-template key for an intent's grounded synthesis (body lives server-side). */
export function retrievalPromptKey(intent: RetrievalIntent): string {
  switch (intent) {
    case RetrievalIntent.Ask:
      return 'ask_book.answer';
    case RetrievalIntent.Recommend:
      return 'recommendations.explain';
    default:
      return 'semantic_search.answer';
  }
}

/** Map an Ask scope to the graph node types most relevant to grounding it. */
export function askScopeNodeTypes(scope: AskScope): readonly string[] {
  switch (scope) {
    case AskScope.Character:
    case AskScope.Relationship:
      return ['character'];
    case AskScope.Timeline:
      return ['event'];
    case AskScope.World:
    case AskScope.Lore:
      return ['location', 'organization', 'object', 'concept'];
    case AskScope.Theme:
      return ['concept'];
    default:
      return ['character', 'location', 'organization', 'object', 'event', 'concept'];
  }
}

// ── Guardrails (server clamps to these; also the shared contract for clients) ────

/** Minimum characters for a searchable query. */
export const RETRIEVAL_QUERY_MIN_CHARS = 2;
/** Maximum characters for a query/question (defensive against runaway prompts). */
export const RETRIEVAL_QUERY_MAX_CHARS = 2_000;
/** Default number of ranked results returned to a client. */
export const RETRIEVAL_DEFAULT_TOP_K = 10;
/** Hard cap on ranked results per request. */
export const RETRIEVAL_MAX_TOP_K = 50;
/** Default per-source candidate cap before ranking (keeps assembly bounded). */
export const RETRIEVAL_DEFAULT_CANDIDATES_PER_SOURCE = 40;
/** Default token budget for assembled context handed to the LLM. */
export const RETRIEVAL_DEFAULT_CONTEXT_TOKENS = 2_000;
/** Default wall-clock budget for the retrieval phase (ms) before the plan degrades. */
export const RETRIEVAL_DEFAULT_TIMEOUT_MS = 8_000;
/** Max saved searches a user may keep. */
export const SAVED_SEARCH_MAX_PER_USER = 50;

/**
 * Inclusive bounds the admin retrieval config is validated against — the shared contract behind
 * `PUT /admin/ai/search-config` (A3). The `UpdateRetrievalConfigDto` decorators and the admin
 * editor's form schema both read these, so a form control cannot offer a value the route rejects.
 * `rankingWeight` is per signal; `0` is legal and disables the signal.
 */
export const RETRIEVAL_CONFIG_BOUNDS = {
  topK: { min: 1, max: RETRIEVAL_MAX_TOP_K },
  candidatesPerSource: { min: 1, max: 200 },
  contextTokens: { min: 200, max: 16_000 },
  timeoutMs: { min: 500, max: 60_000 },
  rankingWeight: { min: 0, max: 1 },
  /** Trailing window `GET /admin/ai/search-analytics` will aggregate over, in days. */
  analyticsWindowDays: { min: 1, max: 90 },
} as const;

/** Default trailing window for search analytics when the caller names none. */
export const SEARCH_ANALYTICS_DEFAULT_WINDOW_DAYS = 7;
