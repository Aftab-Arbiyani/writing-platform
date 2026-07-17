import type { ReactElement } from 'react';

import { AiConfigPage } from '@/features/ai';

/** Lazy route module (docs/11 §9) — AI platform defaults (AF1; code-split). */
export function Component(): ReactElement {
  return <AiConfigPage />;
}
