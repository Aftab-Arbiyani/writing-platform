import type { ReactElement } from 'react';

import { UsageDashboardPage } from '@/features/monetization';

/** Lazy route module (docs/11 §9) — AI usage & cost dashboard (A1c; code-split). */
export function Component(): ReactElement {
  return <UsageDashboardPage />;
}
