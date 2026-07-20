import type { ReactElement } from 'react';

import { SystemInfoPage } from '@/features/system';

/** Lazy route module (docs/11 §9) — System Information (P7.1; code-split). */
export function Component(): ReactElement {
  return <SystemInfoPage />;
}
