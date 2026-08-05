import type { ReactElement } from 'react';

import { AiConversationsPage } from '@/features/ai';

/** Lazy route module (docs/11 §9) — `/settings/ai/conversations` (AF1/AF2 W8, authenticated). */
export function Component(): ReactElement {
  return <AiConversationsPage />;
}
