import type { ReactElement } from 'react';

import { EditProfilePage } from '@/features/settings';

/** Lazy route module — `/settings/profile` (edit profile + media). */
export function Component(): ReactElement {
  return <EditProfilePage />;
}
