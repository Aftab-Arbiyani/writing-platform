import type { ReactElement } from 'react';

import { PiecePage } from '@/features/reading';

/** Lazy route module (docs/11 §9) — the reading view `/p/:slug` (public, optional auth). */
export function Component(): ReactElement {
  return <PiecePage />;
}
