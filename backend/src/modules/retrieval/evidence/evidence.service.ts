import { Injectable } from '@nestjs/common';

import type { AskCitation, RankedCandidate, RetrievalEvidence } from '../retrieval.types';
import { clamp01 } from '../retrieval.text.util';

const DEFAULT_CAP = 12;

/**
 * Evidence service (AF4). Turns ranked candidates into the grounding every response must
 * carry — deduplicated evidence references, citations for Ask answers, and an aggregate
 * confidence. This is the "every AI answer references retrieved evidence" contract made
 * concrete: answers and results cite what they were grounded in, nothing more.
 */
@Injectable()
export class EvidenceService {
  /** Deduplicated, highest-scored evidence across candidates (top-level response evidence). */
  collect(candidates: RankedCandidate[], cap = DEFAULT_CAP): RetrievalEvidence[] {
    const seen = new Set<string>();
    const all: RetrievalEvidence[] = [];
    for (const c of candidates) {
      for (const e of c.evidence) {
        const key = `${e.ref}::${e.quote}`;
        if (seen.has(key)) continue;
        seen.add(key);
        all.push(e);
      }
    }
    return all.sort((a, b) => b.score - a.score).slice(0, cap);
  }

  /** Citations for an Ask answer — the evidence the answer is grounded in. */
  toCitations(evidence: RetrievalEvidence[]): AskCitation[] {
    return evidence.map((e) => ({ ref: e.ref, label: e.label, quote: e.quote }));
  }

  /**
   * Aggregate confidence (0..1) for a result set / answer: the mean confidence of the top
   * results, damped when there are very few results (thin evidence → lower confidence).
   */
  aggregateConfidence(candidates: RankedCandidate[]): number {
    if (candidates.length === 0) return 0;
    const top = candidates.slice(0, 5);
    const mean = top.reduce((sum, c) => sum + c.confidence, 0) / top.length;
    const coverage = Math.min(1, candidates.length / 3); // <3 results → damped
    return clamp01(mean * (0.7 + 0.3 * coverage));
  }
}
