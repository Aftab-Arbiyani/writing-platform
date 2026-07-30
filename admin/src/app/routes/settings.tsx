import type { ReactElement } from 'react';

import { SettingsPage } from '@/features/settings';

/** Lazy route module (docs/11 §9) — the System Settings section (A7; code-split). */
export function Component(): ReactElement {
  return <SettingsPage />;
}
