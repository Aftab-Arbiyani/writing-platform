import type { ReactElement } from 'react';

import { ConfigHealthPage } from '@/features/system';

/** Lazy route module (docs/11 §9) — Configuration Health (P7.1; code-split). */
export function Component(): ReactElement {
  return <ConfigHealthPage />;
}
