import type { ReactElement } from 'react';

import { Placeholder } from '@/app/pages/placeholder';

export function Component(): ReactElement {
  return (
    <Placeholder
      title="Write"
      description="The TipTap editor + publish flow arrive in the editor epic."
    />
  );
}
