/**
 * Retrieval Platform wire contract (AF4 — AI Discovery / Search / Recommendation).
 *
 * The request/response shapes over `/api/v1/ai/*` (search, ask, explorer,
 * recommendations, saved searches) and the admin surface. The provider-agnostic
 * VOCABULARY (intents, query types, sources, ranking signals, scopes, views, kinds)
 * lives in `@qalam/shared` and is re-exported here so a client imports everything
 * retrieval-related from one package.
 *
 * Every search result and recommendation carries its grounding — evidence references,
 * a structured domain object, a confidence, a ranking explanation, a reason, related
 * entities, and a navigation target — so presentation layers render trustworthy,
 * explainable results without re-deriving anything. Handwritten until the backend emits
 * `openapi.json` (same policy as `./ai` and `./story`).
 */
export type {
  AskScope,
  ExplorerView,
  RankingSignal,
  RecommendationKind,
  RetrievalFailureReason,
  RetrievalIntent,
  RetrievalQueryType,
  RetrievalSource,
} from '@qalam/shared';

import type {
  AiTokenUsage,
  AskScope,
  ExplorerView,
  RankingSignal,
  RecommendationKind,
  RetrievalFailureReason,
  RetrievalIntent,
  RetrievalQueryType,
  RetrievalSource,
} from '@qalam/shared';

import type { StoryGraphEdge, StoryGraphNode } from './story.js';

// ── Shared grounding blocks ─────────────────────────────────────────────────────

/** A grounding reference — where a claim/result came from and the supporting text. */
export interface RetrievalEvidence {
  source: RetrievalSource;
  /** Stable ref for navigation/citation: a graph node id, piece id/slug, or chapter cue. */
  ref: string;
  label: string;
  quote: string;
  /** This evidence item's relevance contribution (0..1). */
  score: number;
}

/** An entity related to a result (a graph neighbour, shared tag, same author, …). */
export interface RelatedEntity {
  id: string;
  type: string;
  name: string;
  /** How it relates (edge label, "shared tag", "same author", …). */
  relation: string;
}

/** Where selecting a result should take the user. */
export interface NavigationTarget {
  /** 'graph_node' | 'piece' | 'chapter' | 'author' | 'timeline' | 'explorer' | … */
  kind: string;
  ref: string;
  /** Optional sub-view / anchor (e.g. an explorer view or chapter anchor). */
  view?: string;
}

/** How a result's final score was computed — one entry per contributing signal. */
export interface RankingExplanation {
  /** Final composite score (0..1). */
  score: number;
  signals: Array<{
    signal: RankingSignal;
    weight: number;
    /** The raw signal value (0..1). */
    value: number;
    /** weight × value. */
    contribution: number;
  }>;
  /** One-line human-readable explanation ("high name match + frequently mentioned"). */
  summary: string;
}

/** Aggregate metadata attached to every retrieval response. */
export interface RetrievalResponseMeta {
  /** The retrieval strategies actually executed for this request. */
  sources: RetrievalSource[];
  totalCandidates: number;
  returned: number;
  /** Aggregate answer/result-set confidence (0..1). */
  confidence: number;
  /** True when a source failed/timed out but the request recovered gracefully. */
  degraded: boolean;
  /** Present only when the whole request degraded to empty — classifies why. */
  failureReason?: RetrievalFailureReason;
}

// ── Semantic Search ─────────────────────────────────────────────────────────────

/**
 * `POST /ai/search`.
 *
 * **The filters are FLAT, and `tags` is a comma-separated string** — this mirrors
 * `SemanticSearchDto` exactly (`backend/src/modules/retrieval/dto/retrieval-request.dto.ts`).
 * It previously declared `filters?: { language, genre, tags: string[] }`, a shape the DTO has
 * never had; because the global pipe runs `forbidNonWhitelisted: true` (`backend/src/main.ts`),
 * a client that trusted it got **400 `VALIDATION_FAILED` on the whole search** rather than
 * filters that quietly did nothing. Corrected in W5 before the web client was written
 * ([48 §3.9](../../../docs/48_PlatformParityRegister.md), W5-1); mobile had it right all along.
 */
export interface SemanticSearchRequest {
  query: string;
  /** Scope to one story's graph (owner-scoped). Omit for library-wide search. */
  storyId?: string;
  /** Optional facet hint; the server classifies when absent. */
  queryType?: RetrievalQueryType;
  limit?: number;
  /** Ask for a grounded natural-language synthesis of the results (an LLM call). */
  synthesize?: boolean;
  /** Language code filter (library scope). */
  language?: string;
  /** Genre slug filter (library scope). */
  genre?: string;
  /** Comma-separated tag slugs (library scope) — NOT an array. */
  tags?: string;
}

/** One ranked, grounded, explainable search result. */
export interface SearchResultItem {
  id: string;
  /** The classified facet / domain-object kind. */
  type: string;
  sourceType: RetrievalSource;
  title: string;
  summary: string;
  /** The STRUCTURED domain object (graph-node fields, or a piece/author card). */
  object: Record<string, unknown>;
  confidence: number;
  relevanceScore: number;
  evidence: RetrievalEvidence[];
  relatedEntities: RelatedEntity[];
  navigation: NavigationTarget;
  /** Why this surfaced (mirrors a recommendation reason). */
  reason: string;
  ranking: RankingExplanation;
}

export interface SemanticSearchResponse {
  query: string;
  intent: RetrievalIntent;
  queryType: RetrievalQueryType;
  /** Grounded NL synthesis when `synthesize` was requested; otherwise null. */
  answer: string | null;
  results: SearchResultItem[];
  evidence: RetrievalEvidence[];
  meta: RetrievalResponseMeta;
}

/** `GET /ai/search/suggestions?q=` — lightweight query suggestions. */
export interface SearchSuggestionsResponse {
  suggestions: string[];
}

// ── Ask My Book ─────────────────────────────────────────────────────────────────

/** `POST /ai/ask` and `POST /ai/ask/stream`. */
export interface AskBookRequest {
  storyId: string;
  question: string;
  /** Defaults to `book`. */
  scope?: AskScope;
  /** A named subject to focus scope on (a character/relationship/location name). */
  subject?: string;
  /** Reuse AF1 conversation persistence for multi-turn asks. */
  conversationId?: string;
}

/** One piece of evidence an answer is grounded in. */
export interface AskCitation {
  ref: string;
  label: string;
  quote: string;
  nodeType?: string;
}

/**
 * One Server-Sent Event on `POST /ai/ask/stream` — the `data:` JSON payload, whose `type` repeats
 * the SSE `event:` name (`ai/streaming/sse.util.ts`).
 *
 * It is the AF1 stream protocol plus ONE leading frame: `sources` carries the citations and the
 * aggregate confidence BEFORE any token, so a client can show what an answer will be grounded in
 * while it is still being written. After that the sequence is the ordinary
 * `start` → `delta`* → `done` | `error` (`ask-book.service.ts:13-23`).
 *
 * `progress` never appears here, and `provider`/`model`/`finishReason` are not forwarded — which is
 * why this is its own type rather than a widened `AiStreamEvent`.
 */
export interface AskBookStreamEvent {
  type: 'sources' | 'start' | 'delta' | 'done' | 'error';
  /** Present on `sources`. */
  citations?: AskCitation[];
  /** Present on `sources` — the retrieval's aggregate confidence (0..1). */
  confidence?: number;
  /** Present on `start` and `done`. */
  conversationId?: string | null;
  /** Present on `delta`. */
  text?: string;
  /** Present on `done`. */
  usage?: AiTokenUsage;
  estimatedCostUsd?: number;
  /** Present on `error` — a stable ERROR_CODES string. */
  code?: string;
  message?: string;
}

/** `POST /ai/ask` (non-streaming). Streaming reuses the AF1 SSE protocol. */
export interface AskBookResponse {
  storyId: string;
  scope: AskScope;
  answer: string;
  citations: AskCitation[];
  confidence: number;
  usage: AiTokenUsage;
  estimatedCostUsd: number;
  conversationId: string | null;
}

// ── Story Explorer (renders from graph objects) ─────────────────────────────────

/** `GET /ai/explorer/:storyId/:view`. Nodes/edges ARE the story knowledge graph objects. */
export interface ExplorerViewResponse {
  storyId: string;
  view: ExplorerView;
  nodes: StoryGraphNode[];
  edges: StoryGraphEdge[];
  stats: { nodeCount: number; edgeCount: number };
}

// ── Recommendation Engine ───────────────────────────────────────────────────────

/** `GET /ai/recommendations`. */
export interface RecommendationRequest {
  kind: RecommendationKind;
  /** Seed story for story-scoped kinds (related characters/chapters/topics). */
  storyId?: string;
  /**
   * Seed piece for `related_stories` — the reader's "more like this". `storyId` wins when both are
   * given. `related_chapters` is graph-scoped and takes `storyId` only.
   */
  pieceId?: string;
  limit?: number;
}

/** One explainable recommendation. */
export interface RecommendationItem {
  id: string;
  kind: RecommendationKind;
  /** 'piece' | 'author' | 'genre' | 'collection' | 'character' | 'topic' | 'chapter'. */
  targetType: string;
  title: string;
  summary: string;
  object: Record<string, unknown>;
  score: number;
  confidence: number;
  /** Why it was recommended (always present — recommendations must explain themselves). */
  reason: string;
  /** Which entities influenced the recommendation. */
  influencedBy: RelatedEntity[];
  /** Supporting retrieved evidence. */
  evidence: RetrievalEvidence[];
  navigation: NavigationTarget;
}

export interface RecommendationResponse {
  kind: RecommendationKind;
  items: RecommendationItem[];
  meta: RetrievalResponseMeta;
}

// ── Saved searches ──────────────────────────────────────────────────────────────

export interface SavedSearch {
  id: string;
  name: string;
  query: string;
  queryType: RetrievalQueryType | null;
  storyId: string | null;
  createdAt: string;
}

/** `POST /ai/search/saved`. */
export interface SaveSearchRequest {
  name: string;
  query: string;
  queryType?: RetrievalQueryType;
  storyId?: string;
}

// ── Admin: search/ranking/recommendation configuration + analytics ──────────────

/** Admin-tunable retrieval knobs (stored as settings rows; audited write path). */
export interface RetrievalAdminConfig {
  topK: number;
  candidatesPerSource: number;
  contextTokens: number;
  timeoutMs: number;
  /** Which retrieval strategies are enabled. */
  sources: Record<RetrievalSource, boolean>;
  /** Ranking weights per signal (0..1). */
  rankingWeights: Record<RankingSignal, number>;
  /** Whether grounded LLM synthesis is offered on search. */
  synthesisEnabled: boolean;
}

export type UpdateRetrievalAdminConfig = Partial<RetrievalAdminConfig>;

/** `GET /admin/ai/search-analytics`. Internal quality signals (never shown to end users). */
export interface SearchAnalytics {
  window: string;
  totalQueries: number;
  byIntent: Array<{ intent: RetrievalIntent; count: number }>;
  byQueryType: Array<{ queryType: RetrievalQueryType; count: number }>;
  zeroResultRate: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  avgConfidence: number;
  cacheHitRatio: number;
  avgContextTokens: number;
  failureBreakdown: Array<{ reason: RetrievalFailureReason; count: number }>;
}
