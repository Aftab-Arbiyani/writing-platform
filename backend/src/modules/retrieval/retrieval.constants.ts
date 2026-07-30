/**
 * Retrieval Platform backend-internal constants (AF4). The shared, client-visible
 * guardrails live in `@qalam/shared` (`RETRIEVAL_*`); these are server tuning knobs.
 * The admin-editable versions of the ranking weights / source toggles / budgets are
 * stored as `settings` rows (see settings.catalog additions + RetrievalConfigService),
 * so these are the compiled DEFAULTS the config layer falls back to.
 */
import {
  RankingSignal,
  RetrievalSource,
  RETRIEVAL_DEFAULT_CANDIDATES_PER_SOURCE,
  RETRIEVAL_DEFAULT_CONTEXT_TOKENS,
  RETRIEVAL_DEFAULT_TIMEOUT_MS,
  RETRIEVAL_DEFAULT_TOP_K,
} from '@qalam/shared';

import type { ResolvedRetrievalConfig } from './retrieval.types';

/** ~4 chars/token — mirrors AF1's `AI_CHARS_PER_TOKEN` for a consistent pre-count. */
export const RETRIEVAL_CHARS_PER_TOKEN = 4;

/** Default composite ranking weights (0..1). Admin can override via settings rows. */
export const DEFAULT_RANKING_WEIGHTS: Record<RankingSignal, number> = {
  [RankingSignal.SemanticSimilarity]: 1.0,
  [RankingSignal.GraphDistance]: 0.5,
  [RankingSignal.Popularity]: 0.3,
  [RankingSignal.Freshness]: 0.2,
  [RankingSignal.UserPreferences]: 0.4,
  [RankingSignal.ReadingHistory]: 0.3,
  [RankingSignal.WritingHistory]: 0.3,
  [RankingSignal.Engagement]: 0.3,
  [RankingSignal.Confidence]: 0.6,
};

/** Redis cache namespace + TTLs (reuses the global RedisService DB 0 read-through). */
export const RETRIEVAL_CACHE_PREFIX = 'retrieval';
/** Search/result cache TTL (seconds). */
export const RETRIEVAL_CACHE_TTL_SECONDS = 120;

/** Settings keys for admin-tunable retrieval config (stored as JSON setting rows). */
export const RETRIEVAL_SETTING_KEYS = {
  Config: 'ai.retrieval.config',
} as const;

/**
 * Compiled default retrieval config — the fallback the config layer merges admin overrides
 * over. Mirrored as the seeded `ai.retrieval.config` JSON setting so admins can tune it
 * through the audited settings write path (see settings.catalog + RetrievalConfigService).
 */
export const DEFAULT_RETRIEVAL_CONFIG: ResolvedRetrievalConfig = {
  topK: RETRIEVAL_DEFAULT_TOP_K,
  candidatesPerSource: RETRIEVAL_DEFAULT_CANDIDATES_PER_SOURCE,
  contextTokens: RETRIEVAL_DEFAULT_CONTEXT_TOKENS,
  timeoutMs: RETRIEVAL_DEFAULT_TIMEOUT_MS,
  sources: {
    [RetrievalSource.KnowledgeGraph]: true,
    [RetrievalSource.Metadata]: true,
    [RetrievalSource.Keyword]: true,
    // Reserved extension point — enabled in config, but the retriever reports itself
    // unavailable until an embedding backend lands, so it never runs (and never errors).
    [RetrievalSource.Vector]: true,
  },
  rankingWeights: DEFAULT_RANKING_WEIGHTS,
  synthesisEnabled: true,
};
