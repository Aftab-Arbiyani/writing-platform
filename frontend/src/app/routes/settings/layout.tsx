import type { ReactElement } from 'react';

import { SettingsLayout } from '@/features/settings';

/** Lazy route module (docs/11 §9) — the settings shell (side-nav + `<Outlet/>`). */
export function Component(): ReactElement {
  return <SettingsLayout />;
}
