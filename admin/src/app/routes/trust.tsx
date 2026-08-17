import type { ReactElement } from 'react';

import { UserTrustPage } from '@/features/users';

/** Lazy route module (docs/11 §9) — Trust & safety for one account (A2; code-split). */
export function Component(): ReactElement {
  return <UserTrustPage />;
}
