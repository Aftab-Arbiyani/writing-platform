import type { ReactElement } from 'react';

import { OnboardingPage } from '@/features/onboarding';

/** Lazy route module (docs/11 §9) — the first-run intro `/onboarding` (public, no session). */
export function Component(): ReactElement {
  return <OnboardingPage />;
}
