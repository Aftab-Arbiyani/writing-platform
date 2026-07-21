import type { ReactElement } from 'react';

import { SloDashboardPage } from '@/features/operations';

/** Lazy route module (docs/11 §9) — SLO dashboard (P7.4; code-split). */
export function Component(): ReactElement {
  return <SloDashboardPage />;
}
