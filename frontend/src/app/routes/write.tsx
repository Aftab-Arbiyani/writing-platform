import type { ReactElement } from 'react';

import { EditorPage } from '@/features/writing';

/** Lazy route module (docs/11 §9) — the distraction-free editor (`/write`, `/write/:draftId`). */
export function Component(): ReactElement {
  return <EditorPage />;
}
