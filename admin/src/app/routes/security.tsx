import type { ReactElement } from 'react';

import { SecurityDashboardPage } from '@/features/security';

/** Lazy route module (docs/11 §9) — Security Dashboard (P7.2; code-split). */
export function Component(): ReactElement {
  return <SecurityDashboardPage />;
}
