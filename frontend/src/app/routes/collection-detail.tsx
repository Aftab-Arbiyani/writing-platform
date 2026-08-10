import type { ReactElement } from 'react';

import { CollectionDetailPage } from '@/features/collections';

/** Lazy route module (docs/11 §9) — one collection's pieces (`/me/collections/:collectionId`). */
export function Component(): ReactElement {
  return <CollectionDetailPage />;
}
