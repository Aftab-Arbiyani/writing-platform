import type { ReactElement } from 'react';

import { VerifyEmailPage } from '@/features/auth';

/** Lazy route module (docs/11 §9) — verification pending / success / failed. */
export function Component(): ReactElement {
  return <VerifyEmailPage />;
}
