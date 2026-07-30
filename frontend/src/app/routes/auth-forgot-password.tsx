import type { ReactElement } from 'react';

import { ForgotPasswordPage } from '@/features/auth';

/** Lazy route module (docs/11 §9) — request a password-reset email. */
export function Component(): ReactElement {
  return <ForgotPasswordPage />;
}
