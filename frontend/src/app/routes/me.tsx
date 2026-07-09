import { QPageLoader } from '@qalam/ui';
import type { ReactElement } from 'react';
import { Navigate } from 'react-router';

import { useMe } from '@/hooks/use-me';
import { profilePath, ROUTES } from '@/lib/routes';

/**
 * Lazy route module — `/me`. Resolves the signed-in user's handle from `GET /me` and redirects to
 * their public profile `/@:username` (docs/11 §10). The mobile "You" tab + user menu point here so
 * they need not know the username up front. Falls back to the feed if identity can't be read.
 */
export function Component(): ReactElement {
  const me = useMe();
  if (me.isLoading) return <QPageLoader label="Opening your profile" />;
  if (me.data) return <Navigate to={profilePath(me.data.username)} replace />;
  return <Navigate to={ROUTES.feed} replace />;
}
