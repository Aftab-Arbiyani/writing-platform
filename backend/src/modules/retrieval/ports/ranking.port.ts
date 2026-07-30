/**
 * The ranking-strategy port (AF4). A ranking strategy turns raw candidates into ordered,
 * scored, EXPLAINED results by combining signals (semantic similarity, graph distance,
 * popularity, freshness, preferences, engagement, confidence). The default composite
 * strategy ships in AF4; a future learned/custom ranker is a new implementation bound to
 * {@link RANKING_STRATEGY} — no consumer or pipeline change. Every result must carry a
 * {@link RankingExplanation} (the "why this rank" contract).
 */
import type {
  RankedCandidate,
  RetrievalCandidate,
  RetrievalPlan,
  RetrievalRequest,
} from '../retrieval.types';

export interface RankingStrategy {
  readonly name: string;
  rank(
    candidates: RetrievalCandidate[],
    plan: RetrievalPlan,
    request: RetrievalRequest,
  ): RankedCandidate[];
}

/** DI token for the active ranking strategy (single, swappable). */
export const RANKING_STRATEGY = Symbol('RANKING_STRATEGY');
