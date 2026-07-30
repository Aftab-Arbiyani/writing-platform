import type { ReactElement } from 'react';

import { InfrastructureHealthPage } from '@/features/system';

/** Lazy route module (docs/11 §9) — Infrastructure Health (P7.1; code-split). */
export function Component(): ReactElement {
  return <InfrastructureHealthPage />;
}
