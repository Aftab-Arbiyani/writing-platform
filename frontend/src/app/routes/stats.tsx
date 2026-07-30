import type { ReactElement } from 'react';

import { AnalyticsDashboardPage } from '@/features/analytics';

/** Lazy route module (docs/11 §9) — the Writer Analytics dashboard (auth-gated; echarts code-split). */
export function Component(): ReactElement {
  return <AnalyticsDashboardPage />;
}
