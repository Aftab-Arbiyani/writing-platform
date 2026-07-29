import { QCard } from '@qalam/ui';
import type { ReactElement } from 'react';

import { resolveStatusBanner, type BannerTone } from '../lib/subscription-status';
import type { SubscriptionResponse } from '../types/monetization.types';

const TONE: Record<BannerTone, string> = {
  // Tinted surfaces via the same `/12` fill + `-on-tint` label pairing `QTag` uses, so these banners
  // inherit the palette's solved contrast rather than mixing their own (docs/48 §3.5).
  info: 'bg-info/12 text-info-on-tint',
  warning: 'bg-warning/12 text-warning-on-tint',
  danger: 'bg-danger/12 text-danger-on-tint',
};

/**
 * The subscription's most consequential state, rendered (AF5, W4). The precedence that decides *which*
 * state that is lives in `lib/subscription-status.ts`, so it can be tested without a DOM.
 */
export function SubscriptionStatusBanner({
  subscription,
}: {
  subscription: SubscriptionResponse;
}): ReactElement | null {
  const banner = resolveStatusBanner(subscription);
  if (!banner) return null;
  const Icon = banner.icon;

  return (
    <QCard as="section" className={`border-transparent ${TONE[banner.tone]}`}>
      {/*
       * `role="status"` rather than `alert`: this is present on load as part of the page, and an alert
       * that fires on every visit to a billing page trains a screen-reader user to tune it out.
       */}
      <p role="status" className="flex items-start gap-3 text-sm font-medium">
        <Icon size={18} className="mt-px shrink-0" aria-hidden />
        {banner.text}
      </p>
    </QCard>
  );
}
