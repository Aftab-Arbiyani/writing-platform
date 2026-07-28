import type { ReactElement } from 'react';

import { CollaboratorsPage } from '@/features/collaboration';

/**
 * Lazy route module (docs/11 §9) — `/write/:storyId/collaborators` (AF6 W3a, authenticated).
 * Sits under the write branch because collaboration is a writing-side surface: a story's roster is
 * managed from where the story is worked on.
 */
export function Component(): ReactElement {
  return <CollaboratorsPage />;
}
