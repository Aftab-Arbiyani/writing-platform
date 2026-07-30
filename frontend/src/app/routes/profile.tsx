import type { ReactElement } from 'react';
import { useParams } from 'react-router';

import { NotFound } from '@/app/pages/not-found';
import { ProfilePage } from '@/features/profile';
import { parseHandle } from '@/lib/routes';

/**
 * Lazy route module — the `@handle` writer profile (docs/11 §1.1). Registered as a bare
 * `:handle` (React Router can't match a static-prefix + param in one segment); this module
 * validates the `@` prefix + reserved words and 404s cleanly before hitting the API.
 */
export function Component(): ReactElement {
  const { handle } = useParams();
  const username = parseHandle(handle);
  if (!username) return <NotFound />;
  return <ProfilePage username={username} />;
}
