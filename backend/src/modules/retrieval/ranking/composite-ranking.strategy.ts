import { Injectable } from '@nestjs/common';
import { RankingSignal } from '@qalam/shared';

import type { RankingStrategy } from '../ports/ranking.port';
import type {
  RankedCandidate,
  RankingExplanation,
  RetrievalCandidate,
  RetrievalPlan,
  RetrievalRequest,
} from '../retrieval.types';
import { clamp01 } from '../retrieval.text.util';

/** Human phrase per signal for the ranking explanation summary. */
const SIGNAL_PHRASE: Record<RankingSignal, string> = {
  [RankingSignal.SemanticSimilarity]: 'strong match to your query',
  [RankingSignal.GraphDistance]: 'closely connected in the graph',
  [RankingSignal.Popularity]: 'frequently referenced',
  [RankingSignal.Freshness]: 'recently published',
  [RankingSignal.UserPreferences]: 'matches your preferences',
  [RankingSignal.ReadingHistory]: 'aligns with your reading',
  [RankingSignal.WritingHistory]: 'aligns with your writing',
  [RankingSignal.Engagement]: 'highly engaged with',
  [RankingSignal.Confidence]: 'high-confidence extraction',
};

/**
 * The default composite ranking strategy (AF4). Combines the plan's weighted signals
 * (semantic similarity, graph distance, popularity, freshness, preferences, engagement,
 * confidence) into a single 0..1 score via a weighted average over the signals each
 * candidate actually carries, and emits a per-signal {@link RankingExplanation} so every
 * result explains WHY it ranked where it did. A future learned/custom ranker is a new
 * `RankingStrategy` bound to `RANKING_STRATEGY` — consumers never change.
 */
@Injectable()
export class CompositeRankingStrategy implements RankingStrategy {
  readonly name = 'composite-v1';

  rank(
    candidates: RetrievalCandidate[],
    plan: RetrievalPlan,
    _request: RetrievalRequest,
  ): RankedCandidate[] {
    return candidates
      .map((c) => this.score(c, plan))
      .sort((a, b) => b.score - a.score)
      .slice(0, plan.topK);
  }

  private score(candidate: RetrievalCandidate, plan: RetrievalPlan): RankedCandidate {
    const signals = candidate.signals ?? {};
    const contributions: RankingExplanation['signals'] = [];
    let weightedSum = 0;
    let weightTotal = 0;

    for (const signal of plan.rankingSignals) {
      const value = signals[signal];
      if (value === undefined) continue; // candidate doesn't carry this signal
      const weight = plan.rankingWeights[signal] ?? 0;
      if (weight <= 0) continue;
      const v = clamp01(value);
      weightedSum += weight * v;
      weightTotal += weight;
      contributions.push({ signal, weight, value: v, contribution: weight * v });
    }

    const score = weightTotal > 0 ? clamp01(weightedSum / weightTotal) : candidate.baseScore;
    const sim = clamp01(signals[RankingSignal.SemanticSimilarity] ?? candidate.baseScore);
    const conf = clamp01(signals[RankingSignal.Confidence] ?? candidate.baseScore);
    const confidence = clamp01(0.5 * sim + 0.3 * conf + 0.2 * score);

    contributions.sort((a, b) => b.contribution - a.contribution);
    return {
      ...candidate,
      score,
      confidence,
      ranking: {
        score,
        signals: contributions,
        summary: summarize(contributions),
      },
    };
  }
}

/** One-line explanation from the top contributing signals. */
function summarize(contributions: RankingExplanation['signals']): string {
  const top = contributions.filter((c) => c.value > 0).slice(0, 2);
  if (top.length === 0) return 'baseline relevance';
  return top.map((c) => SIGNAL_PHRASE[c.signal as RankingSignal]).join('; ');
}
