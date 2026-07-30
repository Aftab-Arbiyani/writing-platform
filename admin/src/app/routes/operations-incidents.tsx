import type { ReactElement } from 'react';

import { IncidentDashboardPage } from '@/features/operations';

/** Lazy route module (docs/11 §9) — Incident dashboard (P7.4; code-split). */
export function Component(): ReactElement {
  return <IncidentDashboardPage />;
}
