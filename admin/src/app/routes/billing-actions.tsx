import type { ReactElement } from 'react';

import { BillingActionsPage } from '@/features/monetization';

/** Lazy route module (docs/11 §9) — Billing actions: credits + refunds (A1b; code-split). */
export function Component(): ReactElement {
  return <BillingActionsPage />;
}
