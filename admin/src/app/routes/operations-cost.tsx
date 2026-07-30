import type { ReactElement } from 'react';

import { CostDashboardPage } from '@/features/operations';

/** Lazy route module (docs/11 §9) — Cost dashboard (P7.4; code-split). */
export function Component(): ReactElement {
  return <CostDashboardPage />;
}
