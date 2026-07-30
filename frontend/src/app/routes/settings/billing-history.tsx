import type { ReactElement } from 'react';

import { BillingHistoryPage } from '@/features/monetization';

/** Lazy route module (docs/11 §9) — `/settings/billing/history` (AF5 W4, authenticated). */
export function Component(): ReactElement {
  return <BillingHistoryPage />;
}
