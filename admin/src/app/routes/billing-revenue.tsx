import type { ReactElement } from 'react';

import { RevenueDashboardPage } from '@/features/monetization';

/** Lazy route module (docs/11 §9) — Revenue dashboard (A1c; code-split). */
export function Component(): ReactElement {
  return <RevenueDashboardPage />;
}
