import { QPageLoader } from '@qalam/ui';
import type { ReactElement } from 'react';
import { Navigate } from 'react-router';

import { Landing } from '@/app/pages/placeholder-home';
import { ROUTES } from '@/lib/routes';
import { useAuthStore } from '@/stores/auth.store';
import { useOnboardingStore } from '@/stores/onboarding.store';

/**
 * The `/` route (docs/11 §10): signed-in readers are sent to their feed (home); visitors see
 * the landing page. While the boot session check is unresolved we hold on a loader rather than
 * flashing the visitor landing to a returning user.
 *
 * ## Why the first-run intro is decided HERE and not by a route guard (docs/48 §2 row 7)
 *
 * The intro was first built behind a pathless `RequireOnboarding` guard over the whole chrome tree,
 * mirroring mobile's router guard. **That was wrong for web, and the reason generalises.** Mobile
 * forces onboarding on first launch because an app always starts at its own root; the web is
 * entered at an arbitrary URL. A tree-wide guard would have hijacked a shared story link — somebody
 * opening `/p/:slug` from a message would get a three-slide introduction instead of the story they
 * were sent. Mobile's own guard already carries the seed of this, exempting the auth corridor so "a
 * fresh-install deep link still works"; on web *every* arrival is a deep link.
 *
 * So the intercept lives at the one place that already answers "where does a visitor at the root
 * go", and the condition is deliberately narrow: **an anonymous visitor at `/` who has not seen it.**
 * A returning or signed-in reader is untouched, and every other URL resolves as it always did.
 *
 * It would also have disarmed the browser suite — every anonymous spec (`reader.spec.ts`'s cold slug
 * load among them) would have been redirected. That is the same shape as B4-1 and B6's seat cap:
 * a new gate silently breaking the arrange step of specs written before it.
 *
 * The flag is per-browser ([`onboarding.store`](../../stores/onboarding.store.ts)), so an
 * authenticated visitor is exempt regardless of it — they have self-evidently been here, most often
 * on a browser whose `localStorage` this one cannot read.
 */
export function HomeRoute(): ReactElement {
  const status = useAuthStore((s) => s.status);
  const onboarded = useOnboardingStore((s) => s.complete);

  if (status === 'unknown') return <QPageLoader label="Loading" />;
  if (status === 'authenticated') return <Navigate to={ROUTES.feed} replace />;
  if (!onboarded) return <Navigate to={ROUTES.onboarding} replace />;
  return <Landing />;
}
