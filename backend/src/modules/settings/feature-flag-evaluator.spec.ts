import { evaluateFeatureFlag, rolloutBucket } from './feature-flag-evaluator';

describe('evaluateFeatureFlag', () => {
  it('preserves legacy behaviour for the default (all / 0%) case', () => {
    expect(evaluateFeatureFlag({ key: 'f', enabled: true })).toBe(true);
    expect(evaluateFeatureFlag({ key: 'f', enabled: false })).toBe(false);
    expect(
      evaluateFeatureFlag({ key: 'f', enabled: true, environment: 'all', rolloutPercentage: 0 }),
    ).toBe(true);
  });

  it('honours environment scope', () => {
    const flag = { key: 'f', enabled: true, environment: 'production', rolloutPercentage: 0 };
    expect(evaluateFeatureFlag(flag, { environment: 'production' })).toBe(true);
    expect(evaluateFeatureFlag(flag, { environment: 'staging' })).toBe(false);
    expect(evaluateFeatureFlag(flag, { environment: 'qa' })).toBe(false);
  });

  it('treats a system-level rollout (no subject) as governed by enabled+scope', () => {
    const flag = { key: 'f', enabled: true, environment: 'all', rolloutPercentage: 50 };
    expect(evaluateFeatureFlag(flag, { environment: 'production' })).toBe(true);
  });

  it('buckets subjects deterministically for partial rollout', () => {
    const flag = { key: 'feature.x', enabled: true, rolloutPercentage: 50 };
    const first = evaluateFeatureFlag(flag, { subjectId: 'user-1' });
    const again = evaluateFeatureFlag(flag, { subjectId: 'user-1' });
    expect(first).toBe(again); // stable
    // Roughly half of many subjects are enabled.
    const enabled = Array.from({ length: 400 }, (_, i) =>
      evaluateFeatureFlag(flag, { subjectId: `u${i}` }),
    ).filter(Boolean).length;
    expect(enabled).toBeGreaterThan(120);
    expect(enabled).toBeLessThan(280);
  });

  it('100% rollout is on for everyone, 0% is governed by enabled only', () => {
    expect(
      evaluateFeatureFlag({ key: 'f', enabled: true, rolloutPercentage: 100 }, { subjectId: 'x' }),
    ).toBe(true);
    expect(
      evaluateFeatureFlag({ key: 'f', enabled: true, rolloutPercentage: 0 }, { subjectId: 'x' }),
    ).toBe(true);
  });

  it('rolloutBucket is in range and stable', () => {
    const b = rolloutBucket('feature.x', 'user-1');
    expect(b).toBeGreaterThanOrEqual(0);
    expect(b).toBeLessThan(100);
    expect(rolloutBucket('feature.x', 'user-1')).toBe(b);
  });
});
