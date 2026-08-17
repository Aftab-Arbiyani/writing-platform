import { ENTITLEMENT_CACHE_TTL_SECONDS } from '@qalam/shared';
import { Info } from 'lucide-react';
import type { ReactElement } from 'react';

/**
 * The cache-lag note (A1a) — shown wherever an operator changes an entitlement.
 *
 * The Entitlement Service memoizes each user's snapshot in Redis for
 * `ENTITLEMENT_CACHE_TTL_SECONDS` and the grant/revoke paths invalidate that user's key — but a
 * client holding an already-fetched snapshot keeps it until its own refetch. So a grant is correct
 * on the server immediately and *visible* to the user shortly after.
 *
 * This exists because the alternative is worse than a caveat: without it the operator's next move is
 * to grant the override a second time, or to report the feature as broken. Saying the delay out loud
 * is the cheapest way to prevent both. The number is read from the shared constant so the copy cannot
 * drift from the server's actual TTL.
 *
 * Built from house tokens rather than a UI-kit callout because the kit has no callout primitive; the
 * shape follows the inline-note pattern the settings and audit slices already use.
 */
export function EntitlementCacheNote(): ReactElement {
  return (
    <div
      className="flex items-start gap-2 rounded-md border border-line bg-raised px-3 py-2"
      role="note"
    >
      <Info size={16} strokeWidth={1.75} className="mt-0.5 flex-shrink-0 text-accent" aria-hidden />
      <p className="text-sm text-ink-secondary">
        <span className="font-medium text-ink">
          Entitlement changes are not instant everywhere.
        </span>{' '}
        Overrides take effect on the server immediately. Cached entitlement snapshots refresh within
        about {ENTITLEMENT_CACHE_TTL_SECONDS} seconds, so a user&rsquo;s app may show the old access
        until it next reloads. That is expected &mdash; do not re-grant.
      </p>
    </div>
  );
}
