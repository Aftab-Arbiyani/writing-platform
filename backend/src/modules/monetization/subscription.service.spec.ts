import {
  BillingInterval,
  DEFAULT_PLAN_FEATURES,
  DEFAULT_PLAN_LIMITS,
  PlanTier,
  SubscriptionEventType,
  SubscriptionStatus,
} from '@qalam/shared';
import type { PlanDefinition } from '@qalam/shared';
import type { Repository } from 'typeorm';

import type { DomainEventBus } from '../../common/events/domain-event-bus';
import { DomainEventType } from '../../common/events/domain-events';
import type { CreditService } from './credit.service';
import type { EntitlementService } from './entitlement.service';
import type { Subscription } from './entities/subscription.entity';
import type { SubscriptionEvent } from './entities/subscription-event.entity';
import type { MonetizationConfigService } from './monetization.config-service';
import {
  PlanChangeNoopException,
  SubscriptionAlreadyActiveException,
  SubscriptionInvalidTransitionException,
  SubscriptionNotFoundException,
} from './monetization.exceptions';
import { SubscriptionService } from './subscription.service';
import type { TrialService } from './trial.service';

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeSub(overrides?: Partial<Subscription>): Subscription {
  return {
    id: 'sub-1',
    userId: 'u1',
    tier: PlanTier.Plus,
    status: SubscriptionStatus.Active,
    interval: BillingInterval.Monthly,
    provider: 'stripe',
    currency: 'usd',
    autoRenew: true,
    cancelAtPeriodEnd: false,
    canceledAt: null,
    scheduledTier: null,
    scheduledInterval: null,
    trialStart: null,
    trialEnd: null,
    gracePeriodEnd: null,
    currentPeriodStart: new Date(),
    currentPeriodEnd: new Date(Date.now() + 30 * 86_400_000),
    providerCustomerId: null,
    providerSubscriptionId: null,
    metadata: {},
    createdAt: new Date(),
    ...overrides,
  } as unknown as Subscription;
}

function makePlan(tier: PlanTier, monthlyCredits = 0): PlanDefinition {
  return {
    tier,
    name: tier,
    description: `${tier} plan`,
    features: [...DEFAULT_PLAN_FEATURES[tier]],
    limits: { ...DEFAULT_PLAN_LIMITS[tier] },
    monthlyCredits,
    prices: {},
    trialDays: tier === PlanTier.Free ? 0 : 14,
  } as unknown as PlanDefinition;
}

// ── Factory ────────────────────────────────────────────────────────────────────

function build(opts?: { existingSub?: Subscription | null; planMonthlyCredits?: number }) {
  const sub = opts?.existingSub !== undefined ? opts.existingSub : null;

  const subscriptions = {
    findOne: jest.fn().mockResolvedValue(sub),
    create: jest.fn().mockImplementation((data: unknown) => ({ ...(data as object) })),
    save: jest.fn().mockImplementation((entity: unknown) => Promise.resolve(entity)),
    find: jest.fn().mockResolvedValue([]),
  } as unknown as Repository<Subscription>;

  const events = {
    create: jest.fn().mockImplementation((data: unknown) => ({ ...(data as object), id: 'evt-1' })),
    save: jest.fn().mockImplementation((entity: unknown) => Promise.resolve(entity)),
    createQueryBuilder: jest.fn().mockReturnValue({
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    }),
  } as unknown as Repository<SubscriptionEvent>;

  const entitlements = {
    invalidate: jest.fn().mockResolvedValue(undefined),
  } as unknown as EntitlementService;

  const config = {
    // Return a valid plan for any tier; credits=0 by default to skip grantPlanCredits
    getPlan: jest
      .fn()
      .mockImplementation((tier: PlanTier) =>
        Promise.resolve(makePlan(tier, opts?.planMonthlyCredits ?? 0)),
      ),
    getConfig: jest.fn().mockResolvedValue({ gracePeriodDays: 7 }),
  } as unknown as MonetizationConfigService;

  const trials = {
    isEligible: jest.fn().mockResolvedValue(false),
    windowFor: jest.fn().mockResolvedValue(null),
  } as unknown as TrialService;

  const credits = {
    grant: jest.fn().mockResolvedValue(5_000),
  } as unknown as CreditService;

  const bus = {
    emit: jest.fn().mockResolvedValue(undefined),
  } as unknown as DomainEventBus;

  const service = new SubscriptionService(
    subscriptions,
    events,
    entitlements,
    config,
    trials,
    credits,
    bus,
  );
  return { service, subscriptions, events, entitlements, config, trials, credits, bus };
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('SubscriptionService', () => {
  afterEach(() => jest.clearAllMocks());

  describe('open', () => {
    it('should throw SubscriptionAlreadyActiveException when an active subscription exists', async () => {
      const { service } = build({ existingSub: makeSub({ status: SubscriptionStatus.Active }) });

      await expect(
        service.open({
          userId: 'u1',
          tier: PlanTier.Plus,
          interval: BillingInterval.Monthly,
          provider: 'stripe',
          currency: 'usd',
          activate: false,
          allowTrial: false,
        }),
      ).rejects.toBeInstanceOf(SubscriptionAlreadyActiveException);
    });

    it('should throw SubscriptionAlreadyActiveException when a trialing subscription exists', async () => {
      const { service } = build({ existingSub: makeSub({ status: SubscriptionStatus.Trialing }) });

      await expect(
        service.open({
          userId: 'u1',
          tier: PlanTier.Plus,
          interval: BillingInterval.Monthly,
          provider: 'stripe',
          currency: 'usd',
          activate: false,
          allowTrial: false,
        }),
      ).rejects.toBeInstanceOf(SubscriptionAlreadyActiveException);
    });

    it('should allow opening a new subscription when there is no existing one', async () => {
      const { service, subscriptions, events, entitlements, bus } = build({ existingSub: null });
      (subscriptions.create as jest.Mock).mockReturnValue(
        makeSub({ status: SubscriptionStatus.PendingActivation }),
      );

      await service.open({
        userId: 'u1',
        tier: PlanTier.Plus,
        interval: BillingInterval.Monthly,
        provider: 'stripe',
        currency: 'usd',
        activate: false,
        allowTrial: false,
      });

      expect(subscriptions.save).toHaveBeenCalledTimes(1);
      expect(events.save).toHaveBeenCalledTimes(1);
      // recordEvent always invalidates the entitlement cache
      expect(entitlements.invalidate).toHaveBeenCalledWith('u1');
      expect(bus.emit).toHaveBeenCalledWith(
        DomainEventType.SubscriptionChanged,
        expect.objectContaining({ userId: 'u1' }),
      );
    });

    it('should grant plan credits immediately when activate=true and plan has monthly credits', async () => {
      const { service, credits } = build({
        existingSub: null,
        planMonthlyCredits: 5_000,
      });

      await service.open({
        userId: 'u1',
        tier: PlanTier.Plus,
        interval: BillingInterval.Monthly,
        provider: 'stripe',
        currency: 'usd',
        activate: true,
        allowTrial: false,
      });

      expect(credits.grant).toHaveBeenCalledTimes(1);
      expect(credits.grant).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'u1', amount: 5_000 }),
      );
    });
  });

  describe('changePlan', () => {
    it('should throw PlanChangeNoopException when the tier and interval are unchanged', async () => {
      const { service } = build({ existingSub: makeSub() });

      await expect(
        service.changePlan('u1', PlanTier.Plus, BillingInterval.Monthly, false),
      ).rejects.toBeInstanceOf(PlanChangeNoopException);
    });

    it('should apply an upgrade immediately when atPeriodEnd=false', async () => {
      const { service, subscriptions, events, entitlements, bus } = build({
        existingSub: makeSub({ tier: PlanTier.Plus }),
      });

      const result = await service.changePlan('u1', PlanTier.Pro, BillingInterval.Monthly, false);

      expect(result.tier).toBe(PlanTier.Pro);
      expect(result.scheduledTier).toBeNull();
      expect(events.save).toHaveBeenCalledTimes(1);

      const eventRow = (events.create as jest.Mock).mock
        .calls[0]?.[0] as Partial<SubscriptionEvent>;
      expect(eventRow.type).toBe(SubscriptionEventType.Upgraded);
      expect(eventRow.fromTier).toBe(PlanTier.Plus);

      expect(entitlements.invalidate).toHaveBeenCalledWith('u1');
      expect(bus.emit).toHaveBeenCalledWith(
        DomainEventType.SubscriptionChanged,
        expect.objectContaining({ tier: PlanTier.Pro }),
      );
      expect(subscriptions.save).toHaveBeenCalledTimes(1);
    });

    it('should schedule a downgrade (not apply immediately) and record a Downgraded event', async () => {
      const { service, subscriptions, events } = build({
        existingSub: makeSub({ tier: PlanTier.Pro }),
      });

      const result = await service.changePlan('u1', PlanTier.Plus, BillingInterval.Monthly, false);

      // Downgrade is always scheduled — current tier remains Pro
      expect(result.tier).toBe(PlanTier.Pro);
      expect(result.scheduledTier).toBe(PlanTier.Plus);

      const eventRow = (events.create as jest.Mock).mock
        .calls[0]?.[0] as Partial<SubscriptionEvent>;
      expect(eventRow.type).toBe(SubscriptionEventType.Downgraded);
      expect(subscriptions.save).toHaveBeenCalledTimes(1);
    });

    it('should schedule an upgrade when atPeriodEnd=true', async () => {
      const { service } = build({ existingSub: makeSub({ tier: PlanTier.Plus }) });

      const result = await service.changePlan('u1', PlanTier.Pro, BillingInterval.Monthly, true);

      // atPeriodEnd=true always schedules (even for upgrades)
      expect(result.scheduledTier).toBe(PlanTier.Pro);

      const { events } = build({ existingSub: makeSub({ tier: PlanTier.Plus }) });
      void events; // suppress unused warning
    });
  });

  describe('cancel', () => {
    it('should set cancelAtPeriodEnd=true and keep status Active when immediate=false', async () => {
      const { service, subscriptions, events, bus } = build({
        existingSub: makeSub({ status: SubscriptionStatus.Active }),
      });

      const result = await service.cancel('u1', false);

      expect(result.cancelAtPeriodEnd).toBe(true);
      expect(result.autoRenew).toBe(false);
      expect(result.status).toBe(SubscriptionStatus.Active); // status unchanged
      expect(result.canceledAt).not.toBeNull();

      expect(events.save).toHaveBeenCalledTimes(1);
      const eventRow = (events.create as jest.Mock).mock
        .calls[0]?.[0] as Partial<SubscriptionEvent>;
      expect(eventRow.type).toBe(SubscriptionEventType.Canceled);

      expect(bus.emit).toHaveBeenCalledWith(
        DomainEventType.SubscriptionChanged,
        expect.objectContaining({ userId: 'u1' }),
      );
      expect(subscriptions.save).toHaveBeenCalledTimes(1);
    });

    it('should set status=Canceled and cancelAtPeriodEnd=false when immediate=true', async () => {
      const { service } = build({ existingSub: makeSub({ status: SubscriptionStatus.Active }) });

      const result = await service.cancel('u1', true);

      expect(result.status).toBe(SubscriptionStatus.Canceled);
      expect(result.cancelAtPeriodEnd).toBe(false);
    });

    it('should throw SubscriptionNotFoundException when no subscription exists', async () => {
      const { service } = build({ existingSub: null });

      await expect(service.cancel('u1', false)).rejects.toBeInstanceOf(
        SubscriptionNotFoundException,
      );
    });
  });

  describe('pause', () => {
    it('should transition status to Paused when currently Active', async () => {
      const { service, events, entitlements, bus } = build({
        existingSub: makeSub({ status: SubscriptionStatus.Active }),
      });

      const result = await service.pause('u1');

      expect(result.status).toBe(SubscriptionStatus.Paused);
      expect(events.save).toHaveBeenCalledTimes(1);
      expect(entitlements.invalidate).toHaveBeenCalledWith('u1');
      expect(bus.emit).toHaveBeenCalledWith(
        DomainEventType.SubscriptionChanged,
        expect.objectContaining({ userId: 'u1' }),
      );
    });

    it('should throw SubscriptionInvalidTransitionException when already Paused', async () => {
      const { service } = build({ existingSub: makeSub({ status: SubscriptionStatus.Paused }) });

      await expect(service.pause('u1')).rejects.toBeInstanceOf(
        SubscriptionInvalidTransitionException,
      );
    });

    it('should throw SubscriptionInvalidTransitionException when in GracePeriod', async () => {
      const { service } = build({
        existingSub: makeSub({ status: SubscriptionStatus.GracePeriod }),
      });

      await expect(service.pause('u1')).rejects.toBeInstanceOf(
        SubscriptionInvalidTransitionException,
      );
    });
  });

  describe('resume', () => {
    it('should transition status back to Active when currently Paused', async () => {
      const { service, events } = build({
        existingSub: makeSub({ status: SubscriptionStatus.Paused }),
      });

      const result = await service.resume('u1');

      expect(result.status).toBe(SubscriptionStatus.Active);
      const eventRow = (events.create as jest.Mock).mock
        .calls[0]?.[0] as Partial<SubscriptionEvent>;
      expect(eventRow.type).toBe(SubscriptionEventType.Resumed);
    });

    it('should throw SubscriptionInvalidTransitionException when not Paused', async () => {
      const { service } = build({ existingSub: makeSub({ status: SubscriptionStatus.Active }) });

      await expect(service.resume('u1')).rejects.toBeInstanceOf(
        SubscriptionInvalidTransitionException,
      );
    });
  });

  /**
   * W4-1 (docs/48 §3.6). `listHistory` used to call `getByUser`, which throws
   * `SUBSCRIPTION_NOT_FOUND` — so this endpoint 404'd for every free user while the three sibling
   * ledgers on the same controller answered an empty page for the same viewer. Both clients would
   * otherwise have to special-case one of four identical lists.
   */
  describe('listHistory', () => {
    it('returns an empty page for a user with no subscription instead of throwing', async () => {
      const { service } = build({ existingSub: null });
      await expect(service.listHistory('u1', null, 20)).resolves.toEqual([]);
    });

    it('scopes by user_id, never by a resolved subscription id', async () => {
      // The mechanism, not just the outcome: filtering by user_id is what removes the lookup that
      // threw. A future refactor that goes back through the subscription would fail here even if it
      // happened to return [] for this fixture.
      const { service, events, subscriptions } = build({ existingSub: null });
      await service.listHistory('u1', null, 20);

      const qb = (events.createQueryBuilder as jest.Mock).mock.results[0]?.value as {
        where: jest.Mock;
      };
      expect(qb.where).toHaveBeenCalledWith('e.user_id = :userId', { userId: 'u1' });
      expect(subscriptions.findOne).not.toHaveBeenCalled();
    });

    it('still applies the keyset cursor', async () => {
      const { service, events } = build({ existingSub: null });
      await service.listHistory('u1', { k: '2026-07-29T00:00:00.000Z', id: 'evt-9' }, 20);

      const qb = (events.createQueryBuilder as jest.Mock).mock.results[0]?.value as {
        andWhere: jest.Mock;
      };
      expect(qb.andWhere).toHaveBeenCalledWith(expect.stringContaining('e.created_at'), {
        ck: '2026-07-29T00:00:00.000Z',
        cid: 'evt-9',
      });
    });
  });

  describe('recordEvent side-effects', () => {
    it('should always call entitlements.invalidate after every transition', async () => {
      const { service, entitlements } = build({
        existingSub: makeSub({ status: SubscriptionStatus.Active }),
      });

      await service.cancel('u1', false);

      expect(entitlements.invalidate).toHaveBeenCalledWith('u1');
    });

    it('should always emit SubscriptionChanged on the domain bus after every transition', async () => {
      const { service, bus } = build({
        existingSub: makeSub({ status: SubscriptionStatus.Paused }),
      });

      await service.resume('u1');

      expect(bus.emit).toHaveBeenCalledWith(
        DomainEventType.SubscriptionChanged,
        expect.objectContaining({ eventType: SubscriptionEventType.Resumed }),
      );
    });
  });
});
