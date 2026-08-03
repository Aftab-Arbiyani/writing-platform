import { QButton, QEmptyState } from '@qalam/ui';
import { Ban, Gauge, Sparkles } from 'lucide-react';
import type { ReactElement } from 'react';
import { useNavigate } from 'react-router';

import { ROUTES } from '@/lib/routes';

import { AVAILABILITY_COPY, type AiAvailability } from '@/lib/ai-availability';

const ICONS = {
  off: Sparkles,
  'feature-off': Ban,
  quota: Gauge,
  upgrade: Sparkles,
} as const;

/**
 * The blocked state of an AI surface (W2/AF2) — off, not enabled for this account, out of allowance,
 * or needing a paid plan. Renders nothing when the surface is usable or still resolving.
 *
 * App-level rather than inside `features/ai` because W5 gives `features/search` AI surfaces too, and
 * a feature may not import another feature (docs/26 §4). It renders the shared copy from
 * `@/lib/ai-availability` and knows one route; it holds no feature state.
 *
 * The quota case is the one W2 required from day one: it is a routine outcome of metering, so it
 * reads as information rather than failure, and it says explicitly that the writing is unaffected.
 *
 * **W4 adds the `upgrade` case, and it is the only one of the four that carries an action.** The
 * others end in waiting or in an administrator; an entitlement denial ends in a plan, and the plan
 * comparison is one route away. Navigating there rather than linking to monetization's own components
 * keeps this feature from importing another (docs/26 §4) — the AI panel knows the route, not the
 * billing UI.
 */
export function AiAvailabilityNotice({
  availability,
}: {
  availability: AiAvailability;
}): ReactElement | null {
  const navigate = useNavigate();
  if (availability === 'available' || availability === 'unknown') return null;

  const copy = AVAILABILITY_COPY[availability];
  return (
    <QEmptyState
      icon={ICONS[availability]}
      title={copy.title}
      description={copy.description}
      minHeight={220}
      action={
        availability === 'upgrade' ? (
          <QButton
            variant="primary"
            size="sm"
            onClick={() => {
              void navigate(ROUTES.settingsBillingPlans);
            }}
          >
            See plans
          </QButton>
        ) : undefined
      }
    />
  );
}
