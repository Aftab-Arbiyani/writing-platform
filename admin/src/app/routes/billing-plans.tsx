import type { ReactElement } from 'react';

import { PlansPage } from '@/features/monetization';

/** Lazy route module (docs/11 §9) — Plans & pricing (A1a; code-split). */
export function Component(): ReactElement {
  return <PlansPage />;
}
