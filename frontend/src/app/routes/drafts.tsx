import type { ReactElement } from 'react';

import { DashboardPage } from '@/features/writing';

/** Lazy route module (docs/11 §9) — the writer dashboard (`/me/drafts`, status-tabbed). */
export function Component(): ReactElement {
  return <DashboardPage />;
}
