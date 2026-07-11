import type { ReactElement } from 'react';

import { AnalyticsPage } from '@/features/analytics';

/** Lazy route module (docs/11 §9) — the Platform Analytics dashboard (A8; code-split). */
export function Component(): ReactElement {
  return <AnalyticsPage />;
}
