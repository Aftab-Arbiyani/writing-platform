import type { ReactElement } from 'react';

import { LoginPage } from '@/features/auth';

/** Lazy route module (docs/11 §9) — the admin sign-in screen (guest branch; code-split). */
export function Component(): ReactElement {
  return <LoginPage />;
}
