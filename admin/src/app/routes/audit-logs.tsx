import type { ReactElement } from 'react';

import { AuditPage } from '@/features/audit';

/** Lazy route module (docs/11 §9) — the Audit Logs section (A6; code-split). */
export function Component(): ReactElement {
  return <AuditPage />;
}
