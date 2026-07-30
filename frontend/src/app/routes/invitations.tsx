import type { ReactElement } from 'react';

import { InvitationsInboxPage } from '@/features/collaboration';

/** Lazy route module (docs/11 §9) — `/me/invitations` (AF6 W3a, authenticated). */
export function Component(): ReactElement {
  return <InvitationsInboxPage />;
}
