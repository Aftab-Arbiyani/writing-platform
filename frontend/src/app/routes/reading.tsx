import type { ReactElement } from 'react';

import { ReadingStatsPage } from '@/features/analytics';

/** Lazy route module (docs/11 §9) — the reader's own stats (`/me/reading`, W7c; echarts code-split). */
export function Component(): ReactElement {
  return <ReadingStatsPage />;
}
