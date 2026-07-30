import type { ReactElement } from 'react';

import { SearchPage } from '@/features/search';

/** Lazy route module (docs/11 §9) — the Search & Discovery screen (public; recent needs auth). */
export function Component(): ReactElement {
  return <SearchPage />;
}
