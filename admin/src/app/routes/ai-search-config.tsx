import type { ReactElement } from 'react';

import { SearchConfigPage } from '@/features/ai';

/** Lazy route module (docs/11 §9) — AI retrieval config (AF4 / A3; code-split). */
export function Component(): ReactElement {
  return <SearchConfigPage />;
}
