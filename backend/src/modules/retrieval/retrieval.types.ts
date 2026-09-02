/**
 * Retrieval Platform internal types (AF4). Backend-only shapes that flow through the
 * pipeline: request → plan → candidates → ranked candidates → assembled context →
 * result + telemetry, plus the grounding/config/analytics shapes the services share.
 *
 * NOTE: the backend does NOT import `@qalam/api-types` (that package is the CLIENT wire
 * contract, generated FROM this backend's OpenAPI). These interfaces are the backend's own
 * source of truth; the response DTOs (dto/) and the `@qalam/api-types` mirror match them.
 */
import type {
  AskScope,
  RankingSignal,
  RetrievalFailureReason,
  RetrievalIntent,
  RetrievalQueryType,
  RetrievalSource,
} from '@qalam/shared';

// ── Grounding shapes (carried on every candidate/result) ────────────────────────

/** A grounding reference — where a result came from and the supporting text. */
export interface RetrievalEvidence {
  source: RetrievalSource;
  ref: string;
  label: string;
  quote: string;
  score: number;
}

/** An entity related to a result (a graph neighbour, shared tag, same author, …). */
export interface RelatedEntity {
  id: string;
  type: string;
  name: string;
  relation: string;
}

/** Where selecting a result should take the user. */
export interface NavigationTarget {
  kind: string;
  ref: string;
  view?: string;
}

/** How a result's final score was computed — one entry per contributing signal. */
export interface RankingExplanation {
  score: number;
  signals: Array<{ signal: RankingSignal; weight: number; value: number; contribution: number }>;
  summary: string;
}

/** A citation for an Ask answer — the evidence it is grounded in. */
export interface AskCitation {
  ref: string;
  label: string;
  quote: string;
  nodeType?: string;
}

// ── Config (resolved, admin-tunable) ────────────────────────────────────────────

/** The effective retrieval config (defaults ⊕ admin overrides). Mirrors the wire shape. */
export interface ResolvedRetrievalConfig {
  topK: number;
  candidatesPerSource: number;
  contextTokens: number;
  timeoutMs: number;
  sources: Record<RetrievalSource, boolean>;
  rankingWeights: Record<RankingSignal, number>;
}

/** A partial admin update — source/weight maps may themselves be partial. */
export interface RetrievalConfigPatch {
  topK?: number;
  candidatesPerSource?: number;
  contextTokens?: number;
  timeoutMs?: number;
  sources?: Partial<Record<RetrievalSource, boolean>>;
  rankingWeights?: Partial<Record<RankingSignal, number>>;
}

// ── Pipeline shapes ─────────────────────────────────────────────────────────────

/** The normalised inbound request — every consumer funnels through this one shape. */
export interface RetrievalRequest {
  /**
   * `null` for an anonymous caller (search is public since D5). Owner-scoped sources —
   * today only the knowledge graph — must skip themselves rather than query with a
   * missing owner.
   */
  userId: string | null;
  query: string;
  intent: RetrievalIntent;
  storyId?: string;
  queryType?: RetrievalQueryType;
  scope?: AskScope;
  subject?: string;
  limit: number;
  filters?: { language?: string; genre?: string; tags?: string[] };
  signal?: AbortSignal;
}

/** A raw candidate produced by one retriever, before ranking. */
export interface RetrievalCandidate {
  id: string;
  source: RetrievalSource;
  /** The domain-object kind (graph node type, 'piece', 'author', 'tag', 'chapter', …). */
  type: string;
  title: string;
  summary: string;
  /** The STRUCTURED domain object (graph-node fields, or a piece/author card). */
  object: Record<string, unknown>;
  /** Free-form text used for lexical scoring + context assembly. */
  text: string;
  /** Source-local relevance (0..1) — the retriever's own confidence in the match. */
  baseScore: number;
  /** Pre-computed signal inputs the retriever can supply (0..1 each). */
  signals?: Partial<Record<RankingSignal, number>>;
  evidence: RetrievalEvidence[];
  related: RelatedEntity[];
  navigation: NavigationTarget;
}

/** The execution plan the planner produces and the RetrievalService runs. */
export interface RetrievalPlan {
  intent: RetrievalIntent;
  queryType: RetrievalQueryType;
  sources: RetrievalSource[];
  parallel: boolean;
  candidatesPerSource: number;
  topK: number;
  contextTokens: number;
  timeoutMs: number;
  rankingSignals: RankingSignal[];
  rankingWeights: Record<RankingSignal, number>;
  nodeTypes: string[];
}

/** A candidate after ranking — final score + confidence + per-signal explanation. */
export interface RankedCandidate extends RetrievalCandidate {
  score: number;
  confidence: number;
  ranking: RankingExplanation;
}

/** Assembled, deduplicated, compressed, budgeted context handed to the LLM. */
export interface AssembledContext {
  text: string;
  tokenCount: number;
  compressionRatio: number;
  fragments: number;
  evidence: RetrievalEvidence[];
}

/** One source's execution record (for observability). */
export interface SourceRunMetric {
  source: RetrievalSource;
  candidates: number;
  latencyMs: number;
  ok: boolean;
}

/** Structured telemetry captured for observability + offline evaluation. */
export interface RetrievalTelemetry {
  intent: RetrievalIntent;
  queryType: RetrievalQueryType;
  sources: SourceRunMetric[];
  totalCandidates: number;
  returned: number;
  retrievalLatencyMs: number;
  rankingLatencyMs: number;
  contextAssemblyMs: number;
  contextTokens: number;
  compressionRatio: number;
  cacheHit: boolean;
  evidenceCount: number;
  confidence: number;
  degraded: boolean;
  failureReason: RetrievalFailureReason | null;
}

/** The full result of one retrieval run — everything a consumer needs to respond. */
export interface RetrievalResult {
  plan: RetrievalPlan;
  candidates: RankedCandidate[];
  context: AssembledContext;
  telemetry: RetrievalTelemetry;
}

// ── Analytics (telemetry aggregation → admin) ───────────────────────────────────

export interface SearchAnalyticsData {
  window: string;
  totalQueries: number;
  /**
   * `true` when the window held more rows than the aggregation cap, so every figure here
   * describes the NEWEST `totalQueries` requests rather than the whole window. Without this
   * an admin surface cannot tell a quiet week from a truncated sample.
   */
  truncated: boolean;
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
