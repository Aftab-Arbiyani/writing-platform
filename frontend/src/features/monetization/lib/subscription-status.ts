import { SubscriptionStatus } from '@qalam/shared';
import { CalendarX, CircleAlert, Hourglass, Lock, PauseCircle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { formatDate } from '@/lib/format';

import { planLabel } from './monetization-labels';
import type { SubscriptionResponse } from '../types/monetization.types';

export type BannerTone = 'info' | 'warning' | 'danger';

export interface StatusBanner {
  tone: BannerTone;
  icon: LucideIcon;
  text: string;
}

/**
 * The one thing a subscriber most needs to know about their subscription, or nothing (AF5, W4).
 *
 * Ported from mobile's `_statusBanner`, with the same order of precedence — **and the order is the
 * substance here, not the copy.** Several of these conditions are true at once in ordinary
 * situations, and only the most consequential should speak:
 *
 * - A subscription in its grace period is also, usually, cancelling at period end. Telling someone
 *   "cancels on the 4th" buries the failed payment they can still fix.
 * - A trial that has been cancelled is still a trial. The cancellation is the newer fact and the one
 *   with a deadline attached, so it wins.
 * - A scheduled plan change is the mildest state of all — nothing is lost and nothing needs doing —
 *   so it only speaks when nothing above it does.
 *
 * Pure, and lives in `lib/` rather than beside the component, so the precedence can be tested without
 * rendering. `past_due` is folded into the grace-period case deliberately: both mean a renewal failed
 * and both are inside the dunning window, and `ACCESS_GRANTING_SUBSCRIPTION_STATUSES` treats them
 * alike, so distinguishing them for a reader would be a distinction without a remedy.
 */
export function resolveStatusBanner(sub: SubscriptionResponse): StatusBanner | null {
  if (sub.status === SubscriptionStatus.GracePeriod || sub.status === SubscriptionStatus.PastDue) {
    return {
      tone: 'danger',
      icon: CircleAlert,
      text:
        sub.gracePeriodEnd === null
          ? 'A payment failed. Update your payment method to keep your plan.'
          : `A payment failed. Update your payment method before ${formatDate(sub.gracePeriodEnd)} to keep your plan.`,
    };
  }
  if (sub.status === SubscriptionStatus.Expired || sub.status === SubscriptionStatus.Canceled) {
    return {
      tone: 'danger',
      icon: Lock,
      text: 'Your plan has ended. Resubscribe to restore premium features.',
    };
  }
  if (sub.status === SubscriptionStatus.Paused) {
    return { tone: 'warning', icon: PauseCircle, text: 'Your subscription is paused.' };
  }
  if (sub.cancelAtPeriodEnd && sub.currentPeriodEnd !== null) {
    return {
      tone: 'warning',
      icon: CalendarX,
      text: `Cancels on ${formatDate(sub.currentPeriodEnd)}. You keep your plan until then.`,
    };
  }
  if (sub.status === SubscriptionStatus.Trialing && sub.trialEnd !== null) {
    return {
      tone: 'info',
      icon: Hourglass,
      text: `Your free trial ends on ${formatDate(sub.trialEnd)}.`,
    };
  }
  if (sub.scheduledTier !== null) {
    return {
      tone: 'info',
      icon: CalendarX,
      text: `Changing to ${planLabel(sub.scheduledTier)}${
        sub.currentPeriodEnd === null
          ? ' at the end of this period'
          : ` on ${formatDate(sub.currentPeriodEnd)}`
      }.`,
    };
  }
  return null;
}
