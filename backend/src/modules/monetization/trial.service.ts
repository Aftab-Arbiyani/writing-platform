import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { SubscriptionEventType } from '@qalam/shared';
import type { PlanDefinition } from '@qalam/shared';
import { Repository } from 'typeorm';

import { MonetizationConfigService } from './monetization.config-service';
import { SubscriptionEvent } from './entities/subscription-event.entity';

/** The trial window a subscription should start with. */
export interface TrialWindow {
  start: Date;
  end: Date;
}

/**
 * The Trial service (AF5) — owns trial eligibility + window computation. A user is
 * eligible only if they have never started a trial (checked against the append-only
 * subscription-event history, so eligibility survives a cancel + re-subscribe). The
 * Subscription service asks this before starting a trial; trial length comes from the
 * plan (falling back to the platform default).
 */
@Injectable()
export class TrialService {
  constructor(
    @InjectRepository(SubscriptionEvent)
    private readonly events: Repository<SubscriptionEvent>,
    private readonly config: MonetizationConfigService,
  ) {}

  /** Whether the user may start a free trial (never used one before). */
  async isEligible(userId: string): Promise<boolean> {
    const prior = await this.events.count({
      where: { userId, type: SubscriptionEventType.TrialStarted },
    });
    return prior === 0;
  }

  /** The trial window for a plan (plan.trialDays, else the platform default). */
  async windowFor(plan: PlanDefinition, from: Date = new Date()): Promise<TrialWindow | null> {
    const config = await this.config.getConfig();
    const days = plan.trialDays > 0 ? plan.trialDays : config.trialDays;
    if (days <= 0) {
      return null;
    }
    return { start: from, end: new Date(from.getTime() + days * 86_400_000) };
  }
}
