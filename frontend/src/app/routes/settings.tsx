import type { ReactElement } from 'react';

import { Placeholder } from '@/app/pages/placeholder';

export function Component(): ReactElement {
  return (
    <Placeholder
      title="Settings"
      description="Profile · Account · Appearance — arriving in the settings epic."
    />
  );
}
