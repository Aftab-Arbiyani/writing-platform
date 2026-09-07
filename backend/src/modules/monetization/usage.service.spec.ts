import { AiFeature, DEFAULT_PLAN_LIMITS, PlanTier, QuotaWindow } from '@qalam/shared';

import type { UsageService as AiUsageService } from '../ai';
import type { EntitlementService } from './entitlement.service';
import { QuotaExceededException } from './monetization.exceptions';
import { UsageService } from './usage.service';

// ── Factory ────────────────────────────────────────────────────────────────────

function build(opts?: {
  limits?: Record<string, number>;
  /** What the AI platform reports as this user's request count for the window. */
  actionCount?: number;
}) {
  const limits = opts?.limits ?? DEFAULT_PLAN_LIMITS[PlanTier.Free];

  const entitlements = {
    getLimits: jest.fn().mockResolvedValue(limits),
  } as unknown as EntitlementService;

  const countRequestsSince = jest.fn().mockResolvedValue(opts?.actionCount ?? 0);
  const aiUsage = { countRequestsSince } as unknown as AiUsageService;

  const service = new UsageService(entitlements, aiUsage);
  return { service, entitlements, countRequestsSince };
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('UsageService', () => {
  afterEach(() => jest.clearAllMocks());

  /**
   * D5: allowances count ACTIONS, not tokens. These tests are the token suite's replacement,
   * and the difference is the point — a writer is told "12 of 30 polishes today", so that is
   * what the server counts.
   */
  describe('assertWithinQuota', () => {
    const PLUS = DEFAULT_PLAN_LIMITS[PlanTier.Plus]; // 100 polishes/day, 20 analyses/month

    it('passes while the allowance has room', async () => {
      const { service } = build({ limits: PLUS, actionCount: 12 });

      await expect(
        service.assertWithinQuota('u1', AiFeature.WritingAssistant),
      ).resolves.toBeUndefined();
    });

    it('refuses on the request that would exceed it, not the one that reaches it', async () => {
      const atLimit = build({ limits: PLUS, actionCount: 100 });
      const oneBelow = build({ limits: PLUS, actionCount: 99 });

      // 99 used + this one = 100, exactly the allowance: still allowed.
      await expect(
        oneBelow.service.assertWithinQuota('u1', AiFeature.WritingAssistant),
      ).resolves.toBeUndefined();
      await expect(
        atLimit.service.assertWithinQuota('u1', AiFeature.WritingAssistant),
      ).rejects.toBeInstanceOf(QuotaExceededException);
    });

    /**
     * The message and details are the product surface of this exception — a client renders a
     * progress bar and a sentence from them without parsing prose. The old message could only
     * say "your daily AI usage limit", which named neither the thing nor the number.
     */
    it('names the thing, the numbers, and when it comes back', async () => {
      const { service } = build({ limits: PLUS, actionCount: 100 });

      const thrown = await service.assertWithinQuota('u1', AiFeature.WritingAssistant).then(
        () => {
          throw new Error('expected the allowance to be refused');
        },
        (error: unknown) => error as QuotaExceededException,
      );

      expect(thrown.message).toBe("You've used today's Polish (100 of 100).");
      expect(thrown.details[0]).toMatchObject({
        window: QuotaWindow.Daily,
        limitKey: 'polishActionsPerDay',
        label: 'Polish',
        used: 100,
        limit: 100,
      });
      expect((thrown.details[0] as { resetsAt: string }).resetsAt).not.toBe('');
    });

    it('counts each allowance over its own window and features', async () => {
      const { service, countRequestsSince } = build({ limits: PLUS, actionCount: 0 });

      await service.assertWithinQuota('u1', AiFeature.CraftCoach);
      await service.assertWithinQuota('u1', AiFeature.PlotAnalysis);

      const calls = countRequestsSince.mock.calls as Array<[string, AiFeature[], Date]>;
      expect(calls).toHaveLength(2);
      const [coachCall, analysisCall] = calls as [
        [string, AiFeature[], Date],
        [string, AiFeature[], Date],
      ];
      expect(coachCall[1]).toEqual([AiFeature.CraftCoach]);
      // All five story analyses share one allowance — a writer runs them as one action.
      expect(analysisCall[1]).toHaveLength(5);
      expect(analysisCall[1]).toContain(AiFeature.CharacterAnalysis);
      // Daily window starts today; monthly starts on the 1st — so the monthly cutoff is older.
      expect(analysisCall[2].getTime()).toBeLessThanOrEqual(coachCall[2].getTime());
    });

    /**
     * "Map this story" spends five analyses in one user action. Reserving the whole cost is
     * what stops it dying three analyses in, having spent them and left a half-built graph.
     */
    it('reserves the full cost of a multi-call action up front', async () => {
      const { service } = build({ limits: PLUS, actionCount: 17 }); // 3 left of 20

      await expect(
        service.assertWithinQuota('u1', AiFeature.CharacterAnalysis, 1),
      ).resolves.toBeUndefined();
      await expect(
        service.assertWithinQuota('u1', AiFeature.CharacterAnalysis, 5),
      ).rejects.toBeInstanceOf(QuotaExceededException);
    });

    it('skips the count entirely when the plan grants the allowance without limit', async () => {
      const { service, countRequestsSince } = build({
        limits: DEFAULT_PLAN_LIMITS[PlanTier.Enterprise],
        actionCount: 999_999,
      });

      await expect(
        service.assertWithinQuota('u1', AiFeature.WritingAssistant),
      ).resolves.toBeUndefined();
      expect(countRequestsSince).not.toHaveBeenCalled();
    });

    it('leaves an uncounted feature alone', async () => {
      const { service, countRequestsSince } = build({ limits: PLUS });

      await expect(service.assertWithinQuota('u1', AiFeature.Playground)).resolves.toBeUndefined();
      expect(countRequestsSince).not.toHaveBeenCalled();
    });
  });

  describe('quotas', () => {
    it('reports every allowance with what is left and when it resets', async () => {
      const { service } = build({ limits: DEFAULT_PLAN_LIMITS[PlanTier.Plus], actionCount: 12 });

      const quotas = await service.quotas('u1');

      expect(quotas.map((q) => q.limitKey)).toEqual([
        'polishActionsPerDay',
        'feedbackReportsPerDay',
        'storyAnalysesPerMonth',
      ]);
      expect(quotas[0]).toMatchObject({
        label: 'Polish',
        window: QuotaWindow.Daily,
        used: 12,
        limit: 100,
        remaining: 88,
        unlimited: false,
      });
      expect(quotas[0]?.resetsAt).toBeTruthy();
    });

    it('reports an unlimited allowance as unlimited, not as a huge number', async () => {
      const { service } = build({
        limits: DEFAULT_PLAN_LIMITS[PlanTier.Enterprise],
        actionCount: 40,
      });

      const [polish] = await service.quotas('u1');

      expect(polish).toMatchObject({ used: 40, limit: null, remaining: null, unlimited: true });
    });

    it('never reports negative remaining after an overshoot', async () => {
      const { service } = build({ limits: DEFAULT_PLAN_LIMITS[PlanTier.Plus], actionCount: 105 });

      const [polish] = await service.quotas('u1');

      expect(polish?.remaining).toBe(0);
    });
  });
});
