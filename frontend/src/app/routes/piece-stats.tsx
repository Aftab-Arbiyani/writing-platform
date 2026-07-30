import type { ReactElement } from 'react';

import { PieceAnalyticsPage } from '@/features/analytics';

/** Lazy route module (docs/11 §9) — per-piece analytics (owner-only; auth-gated). */
export function Component(): ReactElement {
  return <PieceAnalyticsPage />;
}
