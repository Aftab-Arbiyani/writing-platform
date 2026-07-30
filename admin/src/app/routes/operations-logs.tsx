import type { ReactElement } from 'react';

import { LogViewerPage } from '@/features/operations';

/** Lazy route module (docs/11 §9) — Log posture viewer (P7.4; code-split). */
export function Component(): ReactElement {
  return <LogViewerPage />;
}
