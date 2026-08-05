import type { ReactElement } from 'react';

import { AiHubPage } from '@/features/ai';

/** Lazy route module (docs/11 §9) — `/settings/ai (the hub)` (AF1/AF2 W8, authenticated). */
export function Component(): ReactElement {
  return <AiHubPage />;
}
