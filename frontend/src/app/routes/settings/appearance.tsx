import type { ReactElement } from 'react';

import { AppearancePage } from '@/features/settings';

/** Lazy route module — `/settings/appearance` (theme, default visibility, notifications). */
export function Component(): ReactElement {
  return <AppearancePage />;
}
