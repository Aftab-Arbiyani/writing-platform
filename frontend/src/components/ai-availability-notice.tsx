import { QButton, QEmptyState } from '@qalam/ui';
import { Ban, Gauge, Lock, PenOff } from 'lucide-react';
import type { ReactElement } from 'react';
import { useNavigate } from 'react-router';

import { ROUTES } from '@/lib/routes';

import { AVAILABILITY_COPY, type AiAvailability } from '@/lib/ai-availability';

/**
 * **No sparkles** (D5 decision 9). The sparkle is the universal "this is AI" mark, and it appeared
 * on three of these states; a notice explaining that a tool is unavailable is a bad place to brand
 * the tool. Each icon now says what kind of situation this is: nothing to write with, blocked,
 * metered, locked.
 */
const ICONS = {
  off: PenOff,
  'feature-off': Ban,
  quota: Gauge,
  upgrade: Lock,
  'upgrade-writing': Lock,
} as const;

/**
 * The blocked state of a writing tool — unavailable, not enabled for this account, out of allowance,
 * or needing a paid plan. Renders nothing when the tool is usable or still resolving.
 *
 * App-level rather than inside `features/ai` because it is read from more than one place and a
 * feature may not import another feature (docs/26 §4). It renders the shared copy from
 * `@/lib/ai-availability` and knows one route; it holds no feature state.
 *
 * The quota case is the one W2 required from day one: it is a routine outcome of metering, so it
 * reads as information rather than failure, and it says explicitly that the writing is unaffected.
 */
export function AiAvailabilityNotice({
  availability,
}: {
  availability: AiAvailability;
}): ReactElement | null {
  const navigate = useNavigate();
  if (availability === 'available' || availability === 'unknown') return null;

  const copy = AVAILABILITY_COPY[availability];
  /**
   * **One state carries an action, and D5 took the other two away.**
   *
   * `self-off` pointed at `/settings/ai`, where B5's switch lived — a route that no longer exists,
   * so the button would have been a link to a 404 offering a remedy the writer cannot perform.
   * `signed-out` offered a sign-in, and the surfaces that could reach it are public now.
   *
   * What remains is the entitlement denial, which is the only one the writer can actually resolve:
   * the others end in waiting or in an administrator, this one ends in a plan. Navigating rather
   * than rendering monetization's own components keeps this from importing another feature
   * (docs/26 §4) — it knows the route, not the billing UI.
   */
  return (
    <QEmptyState
      icon={ICONS[availability]}
      title={copy.title}
      description={copy.description}
      minHeight={220}
      action={
        availability === 'upgrade' || availability === 'upgrade-writing' ? (
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
