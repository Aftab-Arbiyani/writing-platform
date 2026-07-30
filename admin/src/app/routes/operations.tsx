import type { ReactElement } from 'react';

import { OperationsDashboardPage } from '@/features/operations';

/** Lazy route module (docs/11 §9) — Operations overview (P7.4; code-split). */
export function Component(): ReactElement {
  return <OperationsDashboardPage />;
}
