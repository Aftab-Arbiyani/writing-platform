import type { ReactElement } from 'react';

import { SearchAnalyticsPage } from '@/features/ai';

/** Lazy route module (docs/11 §9) — AI search analytics (AF4 / A3; code-split). */
export function Component(): ReactElement {
  return <SearchAnalyticsPage />;
}
