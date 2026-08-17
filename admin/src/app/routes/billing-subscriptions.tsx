import type { ReactElement } from 'react';

import { SubscriptionsDashboardPage } from '@/features/monetization';

/** Lazy route module (docs/11 §9) — Subscriptions dashboard (A1c; code-split). */
export function Component(): ReactElement {
  return <SubscriptionsDashboardPage />;
}
