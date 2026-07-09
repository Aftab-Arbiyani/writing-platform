import type { ReactElement } from 'react';

import { Placeholder } from '@/app/pages/placeholder';

/** Lazy route module (docs/11 §9). Feed screens arrive in the feed epic. */
export function Component(): ReactElement {
  return (
    <Placeholder
      title="Feed"
      description="Following · Trending · Latest · Discover — arriving in the feed epic."
    />
  );
}
