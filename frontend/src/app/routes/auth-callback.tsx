import type { ReactElement } from 'react';

import { GoogleCallbackPage } from '@/features/auth';

/** Lazy route module (docs/11 §9) — Google OAuth landing (one-time code exchange). */
export function Component(): ReactElement {
  return <GoogleCallbackPage />;
}
