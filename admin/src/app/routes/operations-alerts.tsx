import type { ReactElement } from 'react';

import { AlertDashboardPage } from '@/features/operations';

/** Lazy route module (docs/11 §9) — Alert dashboard (P7.4; code-split). */
export function Component(): ReactElement {
  return <AlertDashboardPage />;
}
