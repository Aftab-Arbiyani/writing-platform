import type { ReactElement } from 'react';

import { AiUsagePage } from '@/features/ai';

/** Lazy route module (docs/11 §9) — `/settings/ai/usage` (AF1/AF2 W8, authenticated). */
export function Component(): ReactElement {
  return <AiUsagePage />;
}
