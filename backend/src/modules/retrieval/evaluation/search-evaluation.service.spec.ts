import { SearchEvaluationService, type EvaluationSample } from './search-evaluation.service';

describe('SearchEvaluationService', () => {
  const svc = new SearchEvaluationService();

  it('scores a perfect ranking as precision/recall/ndcg = 1', () => {
    const samples: EvaluationSample[] = [
      {
        id: 'q1',
        retrieved: ['a', 'b', 'c'],
        relevant: ['a', 'b', 'c'],
        confidence: 1,
        grounded: true,
      },
    ];
    const m = svc.evaluate(samples, 3);
    expect(m.precisionAtK).toBe(1);
    expect(m.recallAtK).toBe(1);
    expect(m.ndcgAtK).toBe(1);
    expect(m.mrr).toBe(1);
    expect(m.coverage).toBe(1);
  });

  it('rewards relevant items ranked higher (nDCG/MRR)', () => {
    const good = svc.evaluate([{ id: 'q', retrieved: ['a', 'x', 'y'], relevant: ['a'] }], 3);
    const bad = svc.evaluate([{ id: 'q', retrieved: ['x', 'y', 'a'], relevant: ['a'] }], 3);
    expect(good.mrr).toBeGreaterThan(bad.mrr);
    expect(good.ndcgAtK).toBeGreaterThan(bad.ndcgAtK);
  });

  it('computes hallucination rate and confidence calibration', () => {
    const m = svc.evaluate(
      [
        { id: 'q1', retrieved: ['a'], relevant: ['a'], confidence: 1, grounded: true },
        { id: 'q2', retrieved: ['z'], relevant: ['a'], confidence: 1, grounded: false },
      ],
      3,
    );
    expect(m.hallucinationRate).toBe(0.5);
    // stated confidence 1.0 vs actual accuracy 0.5 → calibration error 0.5.
    expect(m.confidenceCalibrationError).toBeCloseTo(0.5);
  });

  it('returns zeros for an empty dataset', () => {
    expect(svc.evaluate([]).samples).toBe(0);
  });
});
