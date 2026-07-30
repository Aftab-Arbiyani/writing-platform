import type { ReactElement } from 'react';

import { NotificationsPage } from '@/features/notifications';

/** Lazy route module (docs/11 §9) — the Activity Center (authenticated; gated by RequireAuth). */
export function Component(): ReactElement {
  return <NotificationsPage />;
}
