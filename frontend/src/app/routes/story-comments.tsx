import type { ReactElement } from 'react';

import { CommentsPage } from '@/features/collaboration';

/** Lazy route module (docs/11 §9) — `/write/:storyId/comments` (AF6 W3b, authenticated). */
export function Component(): ReactElement {
  return <CommentsPage />;
}
