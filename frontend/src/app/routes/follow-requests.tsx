import type { ReactElement } from 'react';

import { FollowRequestsPage } from '@/features/profile';

/** Lazy route module — `/me/follow-requests` (incoming follow-request inbox). */
export function Component(): ReactElement {
  return <FollowRequestsPage />;
}
