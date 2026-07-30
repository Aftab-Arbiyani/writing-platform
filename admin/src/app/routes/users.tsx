import type { ReactElement } from 'react';

import { UsersPage } from '@/features/users';

/** Lazy route module (docs/11 §9) — the Users section (A4 User Management; code-split). */
export function Component(): ReactElement {
  return <UsersPage />;
}
