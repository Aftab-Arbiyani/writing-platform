import type { ReactElement } from 'react';

import { Placeholder } from '@/app/pages/placeholder';

export function Component(): ReactElement {
  return (
    <Placeholder
      title="Notifications"
      description="The in-app notification tray arrives in the notifications epic."
    />
  );
}
