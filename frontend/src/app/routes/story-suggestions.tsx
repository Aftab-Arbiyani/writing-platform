import type { ReactElement } from 'react';

import { SuggestionsPage } from '@/features/collaboration';

/** Lazy route module (docs/11 §9) — `/write/:storyId/suggestions` (AF6 W3b, authenticated). */
export function Component(): ReactElement {
  return <SuggestionsPage />;
}
