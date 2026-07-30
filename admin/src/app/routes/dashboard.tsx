import type { ReactElement } from 'react';

import { DashboardPage } from '@/features/dashboard';

/** Lazy route module (docs/11 §9) — the admin dashboard (code-split). */
export function Component(): ReactElement {
  return <DashboardPage />;
}
