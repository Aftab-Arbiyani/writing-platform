import type { ReactElement } from 'react';

import { CouponsPage } from '@/features/monetization';

/** Lazy route module (docs/11 §9) — Coupons (A1b; code-split). */
export function Component(): ReactElement {
  return <CouponsPage />;
}
