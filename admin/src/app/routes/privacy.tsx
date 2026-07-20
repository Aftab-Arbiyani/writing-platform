import type { ReactElement } from 'react';

import { PrivacyDashboardPage } from '@/features/security';

/** Lazy route module (docs/11 §9) — Privacy Dashboard (P7.2; code-split). */
export function Component(): ReactElement {
  return <PrivacyDashboardPage />;
}
