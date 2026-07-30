import type { ReactElement } from 'react';

import { ServiceStatusDashboardPage } from '@/features/operations';

/** Lazy route module (docs/11 §9) — Service status dashboard (P7.4; code-split). */
export function Component(): ReactElement {
  return <ServiceStatusDashboardPage />;
}
