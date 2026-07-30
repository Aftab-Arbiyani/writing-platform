import type { ReactElement } from 'react';

import { PlansPage } from '@/features/monetization';

/** Lazy route module (docs/11 §9) — `/settings/billing/plans` (AF5 W4, authenticated). */
export function Component(): ReactElement {
  return <PlansPage />;
}
