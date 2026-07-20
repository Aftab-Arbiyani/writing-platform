import type { ReactElement } from 'react';

import { ComplianceDashboardPage } from '@/features/security';

/** Lazy route module (docs/11 §9) — Compliance Dashboard (P7.2; code-split). */
export function Component(): ReactElement {
  return <ComplianceDashboardPage />;
}
