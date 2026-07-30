import type { ReactElement } from 'react';

import { ModerationPage } from '@/features/moderation';

/** Lazy route module (docs/11 §9) — the Moderation section (A5; code-split). */
export function Component(): ReactElement {
  return <ModerationPage />;
}
