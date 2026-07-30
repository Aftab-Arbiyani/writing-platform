import type { ReactElement } from 'react';

import { ResetPasswordPage } from '@/features/auth';

/** Lazy route module (docs/11 §9) — set a new password from a reset link. */
export function Component(): ReactElement {
  return <ResetPasswordPage />;
}
