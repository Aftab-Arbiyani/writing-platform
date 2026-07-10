import type { ReactElement } from 'react';

import { DiscoverPage } from '@/features/search';

/** Lazy route module (docs/11 §9) — the public Discovery screen (editorial + trending surfaces). */
export function Component(): ReactElement {
  return <DiscoverPage />;
}
