import type { ReactElement } from 'react';

import { BlocksPage } from '@/features/collaboration';

/** Lazy route module (docs/11 §9) — `/settings/blocks` (AF6 W3c, authenticated). */
export function Component(): ReactElement {
  return <BlocksPage />;
}
