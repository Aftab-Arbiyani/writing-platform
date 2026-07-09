import type { ReactElement } from 'react';

import { LoginPage } from '@/features/auth';

/** Lazy route module (docs/11 §9) — the sign-in screen. */
export function Component(): ReactElement {
  return <LoginPage />;
}
