import { Injectable } from '@nestjs/common';

/** One labelled evaluation sample: what the system returned vs. ground truth. */
export interface EvaluationSample {
  id: string;
  /** Ranked result ids the system returned (best first). */
  retrieved: string[];
  /** Ground-truth relevant ids for the query. */
  relevant: string[];
  /** The system's stated confidence for this query (0..1) — for calibration. */
  confidence?: number;
  /** Whether the produced answer was grounded in retrieved evidence — for hallucination. */
  grounded?: boolean;
}

/** Aggregate quality metrics over a dataset. Internal-only — never affects UX. */
export interface EvaluationMetrics {
  samples: number;
  k: number;
  precisionAtK: number;
  recallAtK: number;
  mrr: number;
  ndcgAtK: number;
  /** Fraction of samples with ≥1 relevant item retrieved (answerability). */
  coverage: number;
  /** Fraction of samples whose answer was NOT grounded in evidence. */
  hallucinationRate: number;
  /** |mean stated confidence − actual accuracy| — lower is better calibrated. */
  confidenceCalibrationError: number;
}

/**
 * Search-quality evaluation (AF4) — internal quality measurement, entirely offline-capable.
 * Pure functions over labelled samples: precision/recall@k, MRR, nDCG@k, coverage,
 * hallucination rate, and confidence calibration. It reads NOTHING from the request path
 * and writes NOTHING a user sees — it exists so we can measure and improve retrieval/
 * ranking quality against curated or future offline evaluation datasets. Evaluation must
 * never affect user experience (it is not called during a live search).
 */
@Injectable()
export class SearchEvaluationService {
  evaluate(samples: EvaluationSample[], k = 10): EvaluationMetrics {
    if (samples.length === 0) {
      return {
        samples: 0,
        k,
        precisionAtK: 0,
        recallAtK: 0,
        mrr: 0,
        ndcgAtK: 0,
        coverage: 0,
        hallucinationRate: 0,
        confidenceCalibrationError: 0,
      };
    }

    let precision = 0;
    let recall = 0;
    let mrr = 0;
    let ndcg = 0;
    let covered = 0;
    let ungrounded = 0;
    let confidenceSum = 0;
    let confidenceCount = 0;
    let accuracySum = 0;

    for (const s of samples) {
      const relevant = new Set(s.relevant);
      const topK = s.retrieved.slice(0, k);
      const hits = topK.filter((id) => relevant.has(id)).length;

      precision += topK.length > 0 ? hits / topK.length : 0;
      recall += relevant.size > 0 ? hits / relevant.size : 0;
      mrr += reciprocalRank(s.retrieved, relevant);
      ndcg += ndcgAtK(s.retrieved, relevant, k);

      const answerable = hits > 0;
      if (answerable) covered += 1;
      accuracySum += answerable ? 1 : 0;

      if (s.grounded === false) ungrounded += 1;
      if (s.confidence !== undefined) {
        confidenceSum += s.confidence;
        confidenceCount += 1;
      }
    }

    const n = samples.length;
    const meanConfidence = confidenceCount > 0 ? confidenceSum / confidenceCount : 0;
    const accuracy = accuracySum / n;

    return {
      samples: n,
      k,
      precisionAtK: round(precision / n),
      recallAtK: round(recall / n),
      mrr: round(mrr / n),
      ndcgAtK: round(ndcg / n),
      coverage: round(covered / n),
      hallucinationRate: round(ungrounded / n),
      confidenceCalibrationError: round(Math.abs(meanConfidence - accuracy)),
    };
  }
}

function reciprocalRank(retrieved: string[], relevant: Set<string>): number {
  for (let i = 0; i < retrieved.length; i += 1) {
    if (relevant.has(retrieved[i] as string)) return 1 / (i + 1);
  }
  return 0;
}

function ndcgAtK(retrieved: string[], relevant: Set<string>, k: number): number {
  let dcg = 0;
  const top = retrieved.slice(0, k);
  for (let i = 0; i < top.length; i += 1) {
    if (relevant.has(top[i] as string)) dcg += 1 / Math.log2(i + 2);
  }
  let idcg = 0;
  const ideal = Math.min(relevant.size, k);
  for (let i = 0; i < ideal; i += 1) idcg += 1 / Math.log2(i + 2);
  return idcg > 0 ? dcg / idcg : 0;
}

function round(n: number): number {
  return Number(n.toFixed(4));
}
