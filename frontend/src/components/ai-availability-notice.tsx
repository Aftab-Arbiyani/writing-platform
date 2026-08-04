import { QButton, QEmptyState } from '@qalam/ui';
import { Ban, Gauge, LogIn, Sparkles } from 'lucide-react';
import type { ReactElement } from 'react';
import { useLocation, useNavigate } from 'react-router';

import { ROUTES } from '@/lib/routes';

import { AVAILABILITY_COPY, type AiAvailability } from '@/lib/ai-availability';

const ICONS = {
  off: Sparkles,
  'feature-off': Ban,
  quota: Gauge,
  upgrade: Sparkles,
  'signed-out': LogIn,
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
  const location = useLocation();
  if (availability === 'available' || availability === 'unknown') return null;

  const copy = AVAILABILITY_COPY[availability];
  /**
   * **W5 adds the second state that carries an action**, and it is the one a reader meets most often:
   * every AF4 route needs a session, and the public search page is where a signed-out reader lands.
   * `returnTo` carries the whole location — query string included — because on this page the query,
   * the engine and the filters all live in the URL, so dropping it would return the reader to an empty
   * search rather than to the one they were running.
   */
  const signIn = `${ROUTES.login}?returnTo=${encodeURIComponent(`${location.pathname}${location.search}`)}`;
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
        ) : availability === 'signed-out' ? (
          <QButton
            variant="primary"
            size="sm"
            onClick={() => {
              void navigate(signIn);
            }}
          >
            Sign in
          </QButton>
        ) : undefined
      }
    />
  );
}
