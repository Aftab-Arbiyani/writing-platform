import type { ReactElement } from 'react';

import { AccountPage } from '@/features/settings';

/** Lazy route module — `/settings/account` (username, password, sessions). */
export function Component(): ReactElement {
  return <AccountPage />;
}
