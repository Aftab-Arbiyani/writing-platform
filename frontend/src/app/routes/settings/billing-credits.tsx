import type { ReactElement } from 'react';

import { CreditsPage } from '@/features/monetization';

/** Lazy route module (docs/11 §9) — `/settings/billing/credits` (AF5 W4, authenticated). */
export function Component(): ReactElement {
  return <CreditsPage />;
}
