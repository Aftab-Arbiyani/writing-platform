import { PlanTier } from '@qalam/shared';
import { QButton, QEmptyState } from '@qalam/ui';
import { Gauge, Lock } from 'lucide-react';
import type { ReactElement, ReactNode } from 'react';
import { useNavigate } from 'react-router';

import { formatDate } from '@/lib/format';
import { ROUTES } from '@/lib/routes';

import { useEntitlement } from '../hooks/use-entitlements';
import { isQuotaDenial, isTimeBounded } from '../lib/entitlement-decisions';
import { entitlementReasonLabel, featureLabel, planLabel } from '../lib/monetization-labels';
import { firstTierIncluding } from '../lib/plan-allowances';
import type { EntitlementDecision, PremiumFeature } from '../types/monetization.types';

export interface PremiumGateProps {
  /** The premium capability this content requires, e.g. `PremiumFeature.AiBudget`. */
  feature: PremiumFeature | string;
  /** Rendered only when the SERVER says this viewer is entitled. */
  children: ReactNode;
  /** Stand-in when denied. Omit for the explanatory lock below; pass `null` to render nothing. */
  locked?: ReactNode;
  /**
   * Render `children` while the snapshot is still in flight, instead of holding them back.
   *
   * For content that is merely *annotated* by entitlement rather than restricted by it — the server
   * refuses the action either way — this avoids a flash of lock on every page load.
   */
  optimistic?: boolean;
}

/**
 * Withholds content the viewer is not entitled to (AF5, W4) — the web counterpart of mobile's
 * `PremiumGate`, and the same shape as W3a's `CapabilityGate`.
 *
 * **Fails closed.** Loading (unless `optimistic`), errored, a snapshot that does not mention the
 * feature, and the client flag being off all render the locked slot. Being briefly too strict costs a
 * control that appears a moment late; being too permissive shows a control that then 402s, which reads
 * as a broken app. The server re-checks every premium action regardless — this gate is UX, never the
 * security boundary.
 *
 * **On where this belongs, which is the part mobile got wrong.** Mobile's own `PremiumGate` claims in
 * its doc comment that "every premium affordance elsewhere wraps its content in PremiumGate"; it has
 * zero call sites (docs/48 §3.7, M5-1). So placement here was derived from what the server actually
 * enforces rather than copied, and the answer is narrow: `ai_budget` is the only premium feature any
 * server route asserts (`AiUsageMeterService.checkQuota`, and only while `feature.payments.enabled`
 * is up). Everything else in the catalogue is computed and never checked (W4-3), so it gets a
 * {@link PremiumBadge} and stays usable. Use this component where a denial is real; use the badge
 * where it is aspirational.
 *
 * The default locked slot **reads the server's `reason`, not just its verdict**, because the remedy
 * differs: a spent allowance resets on its own and says when, while an excluded plan needs an upgrade.
 * Offering "See plans" to someone who only has to wait until tomorrow is selling them something they
 * do not need.
 */
export function PremiumGate({
  feature,
  children,
  locked,
  optimistic = false,
}: PremiumGateProps): ReactElement | null {
  const { allowed, decision, isPending } = useEntitlement(feature);

  if (allowed) return <>{children}</>;
  if (isPending && optimistic) return <>{children}</>;
  if (isPending) return null;

  return <>{locked === undefined ? <FeatureLockCard decision={decision} /> : locked}</>;
}

export interface FeatureLockCardProps {
  decision: EntitlementDecision;
}

/**
 * The explanatory lock (AF5, W4) — the default `locked` slot, and exported so a surface can place it
 * itself.
 *
 * Says what happened, in the server's own terms, and offers the action that actually helps. A quota
 * denial gets the reset date and no upgrade button; every other denial gets the plan comparison.
 *
 * **D5 made the title name the tier when one is knowable.** "Polish & feedback needs a paid plan"
 * left the writer to go and work out which paid plan; the answer is compiled into
 * `DEFAULT_PLAN_FEATURES` and costs nothing to say. Codes in no tier's default set — five of the
 * eight — keep the generic sentence, because inventing a tier for them would be worse than vague.
 */
export function FeatureLockCard({ decision }: FeatureLockCardProps): ReactElement {
  const navigate = useNavigate();
  const quota = isQuotaDenial(decision);
  const name = featureLabel(decision.feature);
  const tier = firstTierIncluding(decision.feature);

  const description = quota
    ? decision.expiresAt === null
      ? 'Your allowance resets at the start of the next period.'
      : `Your allowance resets on ${formatDate(decision.expiresAt)}.`
    : `${entitlementReasonLabel(decision.reason)}. A paid plan unlocks it.`;

  const lockedTitle =
    tier === null || tier === PlanTier.Free
      ? `${name} needs a paid plan`
      : `${name} is on ${planLabel(tier)} and above`;

  return (
    <QEmptyState
      icon={quota ? Gauge : Lock}
      title={quota ? `You’ve used your ${name} allowance` : lockedTitle}
      description={description}
      minHeight={220}
      action={
        quota ? undefined : (
          <QButton
            variant="primary"
            size="sm"
            onClick={() => {
              void navigate(ROUTES.settingsBillingPlans);
            }}
          >
            See plans
          </QButton>
        )
      }
    />
  );
}

/**
 * A one-line statement of a time-bounded entitlement — a trial or a grace period.
 *
 * Separate from the lock because it is the opposite situation: the viewer *has* access and needs to
 * know it ends, which is worth saying before it does rather than after. Renders nothing when the
 * decision is not time-bounded or carries no expiry, so a caller can place it unconditionally.
 */
export function EntitlementExpiryNote({
  decision,
}: {
  decision: EntitlementDecision;
}): ReactElement | null {
  if (!isTimeBounded(decision) || decision.expiresAt === null) return null;
  return (
    <p className="text-ink-muted text-xs">
      {entitlementReasonLabel(decision.reason)} until {formatDate(decision.expiresAt)}.
    </p>
  );
}
