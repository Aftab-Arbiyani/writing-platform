import type { ReactElement } from 'react';

import { MetricsViewerPage } from '@/features/operations';

/** Lazy route module (docs/11 §9) — Metrics viewer (P7.4; code-split). */
export function Component(): ReactElement {
  return <MetricsViewerPage />;
}
