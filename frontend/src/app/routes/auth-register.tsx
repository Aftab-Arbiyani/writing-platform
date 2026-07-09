import type { ReactElement } from 'react';

import { RegisterPage } from '@/features/auth';

/** Lazy route module (docs/11 §9) — the create-account screen. */
export function Component(): ReactElement {
  return <RegisterPage />;
}
