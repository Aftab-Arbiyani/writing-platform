import type { ReactElement } from 'react';

import { PublishingPage } from '@/features/collaboration';

/** Lazy route module (docs/11 §9) — `/write/:storyId/publishing` (AF6 W3c, authenticated). */
export function Component(): ReactElement {
  return <PublishingPage />;
}
