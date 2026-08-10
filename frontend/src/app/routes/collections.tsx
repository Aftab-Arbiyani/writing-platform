import type { ReactElement } from 'react';

import { CollectionsPage } from '@/features/collections';

/** Lazy route module (docs/11 §9) — the reader's collections (`/me/collections`, owner-only). */
export function Component(): ReactElement {
  return <CollectionsPage />;
}
