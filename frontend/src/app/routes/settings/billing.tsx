import type { ReactElement } from 'react';

import { SubscriptionPage } from '@/features/monetization';

/** Lazy route module (docs/11 §9) — `/settings/billing` (AF5 W4, authenticated). */
export function Component(): ReactElement {
  return <SubscriptionPage />;
}
