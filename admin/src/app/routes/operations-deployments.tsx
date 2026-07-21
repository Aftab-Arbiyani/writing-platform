import type { ReactElement } from 'react';

import { DeploymentViewerPage } from '@/features/operations';

/** Lazy route module (docs/11 §9) — Deployment viewer (P7.4; code-split). */
export function Component(): ReactElement {
  return <DeploymentViewerPage />;
}
