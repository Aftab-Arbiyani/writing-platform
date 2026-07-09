import type { ReactElement } from 'react';

import { Placeholder } from '@/app/pages/placeholder';

/** Placeholder in the auth corridor (AuthLayout). The sign-in form arrives in the auth epic. */
export function Component(): ReactElement {
  return (
    <Placeholder
      title="Sign in"
      description="Email, Google, and the register flow arrive in the auth epic."
    />
  );
}
