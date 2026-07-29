import { QTag } from '@qalam/ui';
import { Sparkles } from 'lucide-react';
import type { ReactElement } from 'react';

import { planLabel } from '../lib/monetization-labels';
import type { PlanTier } from '../types/monetization.types';

export interface PremiumBadgeProps {
  /**
   * The tier this affordance needs. Shown as the label, so the badge says which plan unlocks it
   * rather than a generic "PRO" that leaves the reader to guess.
   */
  tier?: PlanTier;
  /** Overrides the label outright, for the rare case where a tier name is not the right word. */
  label?: string;
  size?: 'sm' | 'md';
}

/**
 * The marker on a premium affordance (AF5, W4) — the web counterpart of mobile's `PremiumBadge`.
 *
 * **It never gates anything.** It is a label beside a control, not a wrapper around one; the control
 * it sits next to stays live. That division is deliberate: {@link PremiumGate} withholds UI, this
 * only annotates it, so the two are never in tension about who decides.
 *
 * That distinction is what makes the badge the right tool for most of the AF5 feature catalogue.
 * Only `ai_budget` is actually enforced by the server (`AiUsageMeterService.checkQuota`); the other
 * catalogued features — `ai_writing`, `publishing_pro`, `advanced_analytics`, and the rest — are
 * computed by the Entitlement Service and asserted by nothing (docs/48 §3.6, W4-3). Locking a control
 * the server would happily serve is the same defect class as W3c-1 with the sign flipped: not a dead
 * button, but a feature hidden from someone entitled to use it. So an unenforced feature gets a badge
 * that says which plan it belongs to, and keeps working.
 *
 * Uses `QTag color="accent"` rather than a bespoke pill so it inherits the tinted-tag contrast recipe
 * — including whatever the in-flight contrast pass settles on — instead of pinning its own colours.
 */
export function PremiumBadge({ tier, label, size = 'sm' }: PremiumBadgeProps): ReactElement {
  const text = label ?? (tier ? planLabel(tier) : 'Premium');
  return (
    <QTag color="accent" size={size}>
      <Sparkles size={12} aria-hidden />
      {text}
    </QTag>
  );
}
