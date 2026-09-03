import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  ACCESS_GRANTING_SUBSCRIPTION_STATUSES,
  BillingInterval,
  PlanTier,
  SubscriptionEventType,
  SubscriptionStatus,
  isPlanUpgrade,
} from '@qalam/shared';
import { LessThan, Repository } from 'typeorm';

import type { CursorPayload } from '../../common/pagination/cursor.util';
import { DomainEventBus } from '../../common/events/domain-event-bus';
import { DomainEventType } from '../../common/events/domain-events';
import { EntitlementService } from './entitlement.service';
import { MonetizationConfigService } from './monetization.config-service';
import {
  PlanChangeNoopException,
  SubscriptionAlreadyActiveException,
  SubscriptionInvalidTransitionException,
  SubscriptionNotFoundException,
} from './monetization.exceptions';
import { Subscription } from './entities/subscription.entity';
import { SubscriptionEvent } from './entities/subscription-event.entity';
import { TrialService } from './trial.service';

/** Fields to open a subscription row before/at activation. */
export interface OpenSubscriptionInput {
  userId: string;
  tier: PlanTier;
  interval: BillingInterval;
  provider: Subscription['provider'];
  currency: string;
  providerCustomerId?: string | null;
  providerSubscriptionId?: string | null;
  /** Store purchases are already paid → activate immediately; Stripe waits for a webhook. */
  activate: boolean;
  /** Start a free trial if the user is eligible + the plan offers one. */
  allowTrial: boolean;
}

/**
 * The Subscription service (AF5) — owns the subscription LIFECYCLE (and only that; payment
 * provider interaction lives in the Billing service, which calls these methods, so there
 * is no dependency cycle). Every transition writes an append-only `subscription_events`
 * row, emits a `SubscriptionChanged` domain event (notifications + analytics subscribe),
 * and invalidates the user's cached entitlement — so premium access is always consistent
 * with the subscription state, computed in one place. Grants plan access on
 * activation/renewal. One subscription per user.
 */
@Injectable()
export class SubscriptionService {
  constructor(
    @InjectRepository(Subscription) private readonly subscriptions: Repository<Subscription>,
    @InjectRepository(SubscriptionEvent)
    private readonly events: Repository<SubscriptionEvent>,
    private readonly entitlements: EntitlementService,
    private readonly config: MonetizationConfigService,
    private readonly trials: TrialService,
    private readonly bus: DomainEventBus,
  ) {}

  findByUser(userId: string): Promise<Subscription | null> {
    return this.subscriptions.findOne({ where: { userId } });
  }

  async getByUser(userId: string): Promise<Subscription> {
    const subscription = await this.findByUser(userId);
    if (subscription === null) {
      throw new SubscriptionNotFoundException();
    }
    return subscription;
  }

  /** Open (or reuse a lapsed) subscription row for a checkout. */
  async open(input: OpenSubscriptionInput): Promise<Subscription> {
    const existing = await this.findByUser(input.userId);
    if (existing !== null && ACCESS_GRANTING_SUBSCRIPTION_STATUSES.includes(existing.status)) {
      throw new SubscriptionAlreadyActiveException();
    }
    const plan = await this.config.getPlan(input.tier);
    const now = new Date();
    const trial =
      input.allowTrial && plan !== undefined && (await this.trials.isEligible(input.userId))
        ? await this.trials.windowFor(plan, now)
        : null;

    const status =
      trial !== null
        ? SubscriptionStatus.Trialing
        : input.activate
          ? SubscriptionStatus.Active
          : SubscriptionStatus.PendingActivation;

    const subscription =
      existing ?? this.subscriptions.create({ userId: input.userId, metadata: {} });
    subscription.tier = input.tier;
    subscription.interval = input.interval;
    subscription.provider = input.provider;
    subscription.currency = input.currency;
    subscription.status = status;
    subscription.providerCustomerId =
      input.providerCustomerId ?? subscription.providerCustomerId ?? null;
    subscription.providerSubscriptionId =
      input.providerSubscriptionId ?? subscription.providerSubscriptionId ?? null;
    subscription.autoRenew = true;
    subscription.cancelAtPeriodEnd = false;
    subscription.canceledAt = null;
    subscription.scheduledTier = null;
    subscription.scheduledInterval = null;
    subscription.trialStart = trial?.start ?? null;
    subscription.trialEnd = trial?.end ?? null;
    subscription.gracePeriodEnd = null;
    if (status !== SubscriptionStatus.PendingActivation) {
      const period = this.periodFor(input.interval, now, trial?.end ?? null);
      subscription.currentPeriodStart = period.start;
      subscription.currentPeriodEnd = period.end;
    }
    const saved = await this.subscriptions.save(subscription);

    if (trial !== null) {
      await this.recordEvent(saved, SubscriptionEventType.TrialStarted, null, null);
    }
    await this.recordEvent(
      saved,
      status === SubscriptionStatus.PendingActivation
        ? SubscriptionEventType.Created
        : SubscriptionEventType.Activated,
      null,
      null,
    );
    return saved;
  }

  /** Activate a pending subscription (Stripe webhook: first invoice paid). */
  async activate(userId: string, periodEnd: Date | null): Promise<Subscription> {
    const subscription = await this.getByUser(userId);
    const from = subscription.status;
    const now = new Date();
    const period = this.periodFor(subscription.interval, now, periodEnd);
    subscription.status = SubscriptionStatus.Active;
    subscription.currentPeriodStart = period.start;
    subscription.currentPeriodEnd = period.end;
    subscription.gracePeriodEnd = null;
    const saved = await this.subscriptions.save(subscription);
    await this.recordEvent(saved, SubscriptionEventType.Activated, null, from);
    return saved;
  }

  /** Renew (a successful recurring payment): extend the period. */
  async renew(userId: string, periodEnd: Date | null): Promise<Subscription> {
    const subscription = await this.getByUser(userId);
    const now = new Date();
    const period = this.periodFor(subscription.interval, now, periodEnd);
    subscription.status = SubscriptionStatus.Active;
    subscription.currentPeriodStart = period.start;
    subscription.currentPeriodEnd = period.end;
    subscription.gracePeriodEnd = null;
    // Apply a scheduled downgrade/interval change at the renewal boundary.
    if (subscription.scheduledTier !== null) {
      subscription.tier = subscription.scheduledTier;
      subscription.scheduledTier = null;
    }
    if (subscription.scheduledInterval !== null) {
      subscription.interval = subscription.scheduledInterval;
      subscription.scheduledInterval = null;
    }
    const saved = await this.subscriptions.save(subscription);
    await this.recordEvent(saved, SubscriptionEventType.Renewed, null, null);
    return saved;
  }

  /** Upgrade (immediate) or downgrade / interval switch (scheduled to period end). */
  async changePlan(
    userId: string,
    tier: PlanTier,
    interval: BillingInterval,
    atPeriodEnd: boolean,
  ): Promise<Subscription> {
    const subscription = await this.getByUser(userId);
    if (subscription.tier === tier && subscription.interval === interval) {
      throw new PlanChangeNoopException();
    }
    if ((await this.config.getPlan(tier)) === undefined) {
      throw new SubscriptionInvalidTransitionException('Unknown target plan.');
    }
    const fromTier = subscription.tier;
    const upgrade = isPlanUpgrade(fromTier, tier);
    if (upgrade && !atPeriodEnd) {
      // Immediate upgrade — take effect now.
      subscription.tier = tier;
      subscription.interval = interval;
      subscription.scheduledTier = null;
      subscription.scheduledInterval = null;
      const saved = await this.subscriptions.save(subscription);
      await this.recordEvent(saved, SubscriptionEventType.Upgraded, fromTier, null);
      return saved;
    }
    // Downgrade / interval switch — schedule for the period boundary (keep current access).
    subscription.scheduledTier = tier;
    subscription.scheduledInterval = interval;
    const saved = await this.subscriptions.save(subscription);
    await this.recordEvent(
      saved,
      upgrade ? SubscriptionEventType.PlanChangeScheduled : SubscriptionEventType.Downgraded,
      fromTier,
      null,
    );
    return saved;
  }

  /** Cancel: immediately, or at period end (keeps access until then). */
  async cancel(userId: string, immediate: boolean): Promise<Subscription> {
    const subscription = await this.getByUser(userId);
    const from = subscription.status;
    subscription.autoRenew = false;
    subscription.canceledAt = new Date();
    if (immediate) {
      subscription.status = SubscriptionStatus.Canceled;
      subscription.cancelAtPeriodEnd = false;
    } else {
      subscription.cancelAtPeriodEnd = true;
    }
    const saved = await this.subscriptions.save(subscription);
    await this.recordEvent(saved, SubscriptionEventType.Canceled, null, from);
    return saved;
  }

  /** Reactivate a cancel-at-period-end subscription (undo the pending cancel). */
  async reactivate(userId: string): Promise<Subscription> {
    const subscription = await this.getByUser(userId);
    if (!subscription.cancelAtPeriodEnd && subscription.status !== SubscriptionStatus.Canceled) {
      throw new SubscriptionInvalidTransitionException('Subscription is not cancelling.');
    }
    subscription.cancelAtPeriodEnd = false;
    subscription.autoRenew = true;
    subscription.canceledAt = null;
    if (subscription.status === SubscriptionStatus.Canceled) {
      subscription.status = SubscriptionStatus.Active;
    }
    const saved = await this.subscriptions.save(subscription);
    await this.recordEvent(saved, SubscriptionEventType.Reactivated, null, null);
    return saved;
  }

  async pause(userId: string): Promise<Subscription> {
    const subscription = await this.getByUser(userId);
    if (subscription.status !== SubscriptionStatus.Active) {
      throw new SubscriptionInvalidTransitionException(
        'Only an active subscription can be paused.',
      );
    }
    subscription.status = SubscriptionStatus.Paused;
    const saved = await this.subscriptions.save(subscription);
    await this.recordEvent(saved, SubscriptionEventType.Paused, null, SubscriptionStatus.Active);
    return saved;
  }

  async resume(userId: string): Promise<Subscription> {
    const subscription = await this.getByUser(userId);
    if (subscription.status !== SubscriptionStatus.Paused) {
      throw new SubscriptionInvalidTransitionException('Subscription is not paused.');
    }
    subscription.status = SubscriptionStatus.Active;
    const saved = await this.subscriptions.save(subscription);
    await this.recordEvent(saved, SubscriptionEventType.Resumed, null, SubscriptionStatus.Paused);
    return saved;
  }

  /** A failed renewal → enter the dunning grace window (access continues until it ends). */
  async enterGracePeriod(userId: string): Promise<Subscription> {
    const subscription = await this.getByUser(userId);
    const config = await this.config.getConfig();
    subscription.status = SubscriptionStatus.GracePeriod;
    subscription.gracePeriodEnd = new Date(Date.now() + config.gracePeriodDays * 86_400_000);
    const saved = await this.subscriptions.save(subscription);
    await this.recordEvent(saved, SubscriptionEventType.GraceStarted, null, null);
    return saved;
  }

  /** Terminal lapse (grace expired / store subscription ended). */
  async expire(subscription: Subscription): Promise<Subscription> {
    const from = subscription.status;
    subscription.status = SubscriptionStatus.Expired;
    const saved = await this.subscriptions.save(subscription);
    await this.recordEvent(saved, SubscriptionEventType.Expired, null, from);
    return saved;
  }

  /**
   * Cursor-paginated subscription history (newest first).
   *
   * **Answers an empty page for a user with no subscription, not a 404.** It used to resolve the
   * subscription with `getByUser`, which throws `SUBSCRIPTION_NOT_FOUND` — so this endpoint 404'd for
   * every free user while its three sibling ledgers on the same controller (`/invoices`, `/payments`,
   * `/purchases`) answered `data: []` for exactly the same viewer. Having no subscription is the
   * majority state, so the majority of callers got an error where the truth was "nothing has happened
   * yet", and both clients would have had to special-case one of four otherwise-identical lists
   * (48 §3.6 W4-1).
   *
   * Scoping the query by `user_id` instead of by a resolved subscription id makes it match its
   * siblings and removes the need for the lookup at all. The events table carries `user_id`, so this is
   * the same owner scoping the other three use — not a widening.
   */
  async listHistory(
    userId: string,
    cursor: CursorPayload | null,
    limit: number,
  ): Promise<SubscriptionEvent[]> {
    const qb = this.events
      .createQueryBuilder('e')
      .where('e.user_id = :userId', { userId })
      .orderBy('e.created_at', 'DESC')
      .addOrderBy('e.id', 'DESC')
      .limit(limit + 1);
    if (cursor !== null) {
      qb.andWhere('(e.created_at, e.id) < (:ck::timestamptz, :cid::uuid)', {
        ck: cursor.k,
        cid: cursor.id,
      });
    }
    return qb.getMany();
  }

  /**
   * Lifecycle sweep (run by the scheduler / lifecycle-sweep job): find subscriptions whose
   * trial or grace window has passed and transition them, emitting the trial-ending nudge
   * for trials about to end. Bounded work; idempotent.
   */
  async runLifecycleSweep(now: Date = new Date()): Promise<{ expired: number; nudged: number }> {
    let expired = 0;
    let nudged = 0;

    // 1. Grace windows that have elapsed → expire.
    const graceExpired = await this.subscriptions.find({
      where: { status: SubscriptionStatus.GracePeriod, gracePeriodEnd: LessThan(now) },
      take: 500,
    });
    for (const subscription of graceExpired) {
      await this.expire(subscription);
      expired += 1;
    }

    // 2. Trials ending within 3 days → nudge once (idempotency is best-effort here).
    const soon = new Date(now.getTime() + 3 * 86_400_000);
    const endingTrials = await this.subscriptions.find({
      where: { status: SubscriptionStatus.Trialing, trialEnd: LessThan(soon) },
      take: 500,
    });
    for (const subscription of endingTrials) {
      if (subscription.trialEnd !== null && subscription.trialEnd.getTime() < now.getTime()) {
        // Trial already lapsed and not converted → cancel to free.
        await this.expire(subscription);
        expired += 1;
      } else if (subscription.trialEnd !== null) {
        await this.bus.emit(DomainEventType.SubscriptionTrialEnding, {
          subscriptionId: subscription.id,
          userId: subscription.userId,
          trialEnd: subscription.trialEnd.toISOString(),
        });
        nudged += 1;
      }
    }
    return { expired, nudged };
  }

  // ── Internals ──────────────────────────────────────────────────────────────

  private periodFor(
    interval: BillingInterval,
    start: Date,
    explicitEnd: Date | null,
  ): { start: Date; end: Date } {
    if (explicitEnd !== null) {
      return { start, end: explicitEnd };
    }
    const end = new Date(start);
    if (interval === BillingInterval.Yearly) {
      end.setUTCFullYear(end.getUTCFullYear() + 1);
    } else {
      end.setUTCMonth(end.getUTCMonth() + 1);
    }
    return { start, end };
  }

  /** Write a history row, emit the domain event, and invalidate the entitlement cache. */
  private async recordEvent(
    subscription: Subscription,
    type: SubscriptionEventType,
    fromTier: PlanTier | null,
    fromStatus: SubscriptionStatus | null,
  ): Promise<void> {
    await this.events.save(
      this.events.create({
        subscriptionId: subscription.id,
        userId: subscription.userId,
        type,
        fromTier,
        toTier: subscription.tier,
        fromStatus,
        toStatus: subscription.status,
        metadata: {},
      }),
    );
    await this.entitlements.invalidate(subscription.userId);
    await this.bus.emit(DomainEventType.SubscriptionChanged, {
      subscriptionId: subscription.id,
      userId: subscription.userId,
      eventType: type,
      tier: subscription.tier,
      status: subscription.status,
    });
  }
}
