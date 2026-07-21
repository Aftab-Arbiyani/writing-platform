import type { ReactElement } from 'react';

import { TracingViewerPage } from '@/features/operations';

/** Lazy route module (docs/11 §9) — Tracing viewer (P7.4; code-split). */
export function Component(): ReactElement {
  return <TracingViewerPage />;
}
