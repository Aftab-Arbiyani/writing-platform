import type { ReactElement } from 'react';

import { FeedPage } from '@/features/feed';

/** Lazy route module (docs/11 §9) — the Home / Feed screen (public; following tab needs auth). */
export function Component(): ReactElement {
  return <FeedPage />;
}
