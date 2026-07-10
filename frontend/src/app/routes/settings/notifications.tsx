import type { ReactElement } from 'react';

import { NotificationPreferencesPage } from '@/features/notifications';

/** Lazy route module (docs/11 §9) — notification preferences, nested in the settings shell. */
export function Component(): ReactElement {
  return <NotificationPreferencesPage />;
}
