import { CreditReason, DEFAULT_PLAN_LIMITS, PlanTier, QuotaWindow } from '@qalam/shared';
import type { Repository } from 'typeorm';

import type { CreditTransaction } from './entities/credit-transaction.entity';
import type { EntitlementService } from './entitlement.service';
import { QuotaExceededException } from './monetization.exceptions';
import { UsageService } from './usage.service';

// ── QB mock helpers ───────────────────────────────────────────────────────────

/** A reusable chainable QueryBuilder mock whose terminal methods are configurable. */
function makeQb(opts?: {
  rawOne?: Record<string, string> | null;
  rawMany?: Array<Record<string, string>>;
}) {
  return {
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    setParameter: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    getRawOne: jest
      .fn()
      .mockResolvedValue(opts?.rawOne ?? { tokens: '0', credits: '0', cost: '0', requests: '0' }),
    getRawMany: jest.fn().mockResolvedValue(opts?.rawMany ?? []),
    getMany: jest.fn().mockResolvedValue([]),
  };
}

// ── Factory ────────────────────────────────────────────────────────────────────

function build(opts?: {
  limits?: { aiDailyTokens: number; aiMonthlyTokens: number; aiMonthlyCredits: number };
  /** getRawOne responses, in call order. Each entry is used once. */
  rawOnes?: Array<Record<string, string> | null>;
}) {
  const limits = opts?.limits ?? DEFAULT_PLAN_LIMITS[PlanTier.Free];

  const entitlements = {
    getLimits: jest.fn().mockResolvedValue(limits),
  } as unknown as EntitlementService;

  const rawOnes = opts?.rawOnes ?? [];
  let callCount = 0;
  const qb = makeQb();
  // Allow sequential getRawOne return values via mockImplementation
  (qb.getRawOne as jest.Mock).mockImplementation(() => {
    const value = rawOnes[callCount] ?? { tokens: '0', credits: '0', cost: '0', requests: '0' };
    callCount += 1;
    return Promise.resolve(value);
  });

  const ledger = {
    createQueryBuilder: jest.fn().mockReturnValue(qb),
  } as unknown as Repository<CreditTransaction>;

  const service = new UsageService(ledger, entitlements);
  return { service, entitlements, ledger, qb };
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('UsageService', () => {
  afterEach(() => jest.clearAllMocks());

  describe('assertWithinQuota', () => {
    it('should resolve without throwing when the user is under both limits', async () => {
      const { service } = build({
        limits: { aiDailyTokens: 20_000, aiMonthlyTokens: 200_000, aiMonthlyCredits: 0 },
        rawOnes: [
          { tokens: '5000' }, // daily usage — under 20k limit
          { tokens: '50000' }, // monthly usage — under 200k limit
        ],
      });

      await expect(service.assertWithinQuota('u1')).resolves.toBeUndefined();
    });

    it('should throw QuotaExceededException(Daily) when daily token sum equals the daily limit', async () => {
      const { service } = build({
        limits: { aiDailyTokens: 20_000, aiMonthlyTokens: 200_000, aiMonthlyCredits: 0 },
        rawOnes: [{ tokens: '20000' }], // exactly at the daily cap
      });

      await expect(service.assertWithinQuota('u1')).rejects.toBeInstanceOf(QuotaExceededException);
    });

    it('should throw QuotaExceededException(Daily) when daily usage exceeds the cap', async () => {
      const { service } = build({
        limits: { aiDailyTokens: 20_000, aiMonthlyTokens: 200_000, aiMonthlyCredits: 0 },
        rawOnes: [{ tokens: '25000' }], // over the daily cap
      });

      let thrown: unknown;
      try {
        await service.assertWithinQuota('u1');
      } catch (err) {
        thrown = err;
      }

      expect(thrown).toBeInstanceOf(QuotaExceededException);
      expect((thrown as QuotaExceededException).message).toContain(QuotaWindow.Daily);
    });

    it('should throw QuotaExceededException(Monthly) when daily is under cap but monthly hits the cap', async () => {
      const { service } = build({
        limits: { aiDailyTokens: 20_000, aiMonthlyTokens: 200_000, aiMonthlyCredits: 0 },
        rawOnes: [
          { tokens: '1000' }, // daily — fine
          { tokens: '200000' }, // monthly — at the cap
        ],
      });

      let thrown: unknown;
      try {
        await service.assertWithinQuota('u1');
      } catch (err) {
        thrown = err;
      }

      expect(thrown).toBeInstanceOf(QuotaExceededException);
      expect((thrown as QuotaExceededException).message).toContain(QuotaWindow.Monthly);
    });

    it('should skip the daily check when aiDailyTokens is 0 (unlimited)', async () => {
      const { service, qb } = build({
        limits: { aiDailyTokens: 0, aiMonthlyTokens: 200_000, aiMonthlyCredits: 0 },
        rawOnes: [{ tokens: '50000' }],
      });

      await service.assertWithinQuota('u1');

      // Only one getRawOne call — the monthly check (daily was skipped because limit=0)
      expect(qb.getRawOne).toHaveBeenCalledTimes(1);
    });

    it('should skip the monthly check when aiMonthlyTokens is 0 (unlimited)', async () => {
      const { service, qb } = build({
        limits: { aiDailyTokens: 20_000, aiMonthlyTokens: 0, aiMonthlyCredits: 0 },
        rawOnes: [{ tokens: '5000' }], // daily — under cap
      });

      await service.assertWithinQuota('u1');

      // Only one getRawOne call — the daily check (monthly was skipped because limit=0)
      expect(qb.getRawOne).toHaveBeenCalledTimes(1);
    });

    it('should query using CreditReason.AiUsage filter', async () => {
      const { service, qb } = build({
        limits: { aiDailyTokens: 20_000, aiMonthlyTokens: 200_000, aiMonthlyCredits: 0 },
        rawOnes: [{ tokens: '100' }, { tokens: '1000' }],
      });

      await service.assertWithinQuota('u1');

      // Both sumTokensSince calls use andWhere with the AiUsage reason
      const andWhereCalls = (qb.andWhere as jest.Mock).mock.calls as Array<[string, unknown]>;
      const reasonCalls = andWhereCalls.filter(([sql]) => sql.includes('reason'));
      expect(reasonCalls.length).toBeGreaterThanOrEqual(1);
      const reasonCall = reasonCalls[0] as [string, { reason: string }];
      expect(reasonCall[1]).toMatchObject({ reason: CreditReason.AiUsage });
    });
  });

  describe('getSummary', () => {
    it('should return a summary with all required window fields', async () => {
      const { service } = build({
        limits: DEFAULT_PLAN_LIMITS[PlanTier.Plus],
        rawOnes: [
          { tokens: '1000', credits: '10', cost: '0.01', requests: '5' }, // daily
          { tokens: '15000', credits: '150', cost: '0.15', requests: '50' }, // monthly
          { tokens: '20000', credits: '200', cost: '0.20', requests: '70' }, // total
        ],
      });

      const summary = await service.getSummary('u1');

      expect(summary.daily.window).toBe(QuotaWindow.Daily);
      expect(summary.monthly.window).toBe(QuotaWindow.Monthly);
      expect(summary.total.window).toBe(QuotaWindow.Total);
      expect(summary.daily.tokens).toBe(1000);
      expect(summary.monthly.tokens).toBe(15_000);
    });

    it('should compute a linear monthly token forecast', async () => {
      const { service } = build({
        limits: DEFAULT_PLAN_LIMITS[PlanTier.Plus],
        rawOnes: [
          { tokens: '1000', credits: '10', cost: '0.01', requests: '5' }, // daily
          { tokens: '10000', credits: '100', cost: '0.10', requests: '20' }, // monthly
          { tokens: '10000', credits: '100', cost: '0.10', requests: '20' }, // total
        ],
      });

      const summary = await service.getSummary('u1');

      // forecast = monthly.tokens * (daysInMonth / daysElapsed) >= monthly.tokens
      expect(summary.forecastMonthlyTokens).toBeGreaterThanOrEqual(summary.monthly.tokens);
      expect(typeof summary.forecastMonthlyTokens).toBe('number');
      expect(typeof summary.forecastMonthlyCostUsd).toBe('number');
    });

    it('should include the token limit and usedFraction in the daily window', async () => {
      const { service } = build({
        limits: { aiDailyTokens: 20_000, aiMonthlyTokens: 200_000, aiMonthlyCredits: 5_000 },
        rawOnes: [
          { tokens: '10000', credits: '100', cost: '0.10', requests: '10' },
          { tokens: '100000', credits: '1000', cost: '1.00', requests: '100' },
          { tokens: '150000', credits: '1500', cost: '1.50', requests: '150' },
        ],
      });

      const summary = await service.getSummary('u1');

      expect(summary.daily.tokenLimit).toBe(20_000);
      expect(summary.daily.usedFraction).toBe(0.5); // 10000 / 20000
      expect(summary.monthly.creditLimit).toBe(5_000);
    });

    it('should include a byFeature breakdown', async () => {
      const featureRows = [{ feature: 'ai_writing', tokens: '500', credits: '5', requests: '3' }];
      const { service, qb } = build({
        limits: DEFAULT_PLAN_LIMITS[PlanTier.Free],
        rawOnes: [
          { tokens: '500', credits: '5', cost: '0.005', requests: '3' },
          { tokens: '500', credits: '5', cost: '0.005', requests: '3' },
          { tokens: '500', credits: '5', cost: '0.005', requests: '3' },
        ],
      });
      (qb.getRawMany as jest.Mock).mockResolvedValue(featureRows);

      const summary = await service.getSummary('u1');

      expect(summary.byFeature).toHaveLength(1);
      expect(summary.byFeature[0]).toMatchObject({ feature: 'ai_writing', tokens: 500 });
    });
  });
});
