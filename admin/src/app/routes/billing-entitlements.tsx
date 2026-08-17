import type { ReactElement } from 'react';

import { EntitlementsPage } from '@/features/monetization';

/** Lazy route module (docs/11 §9) — Entitlement overrides (A1a; code-split). */
export function Component(): ReactElement {
  return <EntitlementsPage />;
}
