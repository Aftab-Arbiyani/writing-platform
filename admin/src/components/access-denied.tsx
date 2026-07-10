import { QEmptyState } from '@qalam/ui';
import { ShieldX } from 'lucide-react';
import type { ReactElement, ReactNode } from 'react';

/**
 * Inline "no access" block for use by `RoleGuard` / `PermissionGuard` when a denied area should be
 * shown as an honest deny (rather than hidden). For whole-page denials use the `/403` Forbidden
 * page; this is the in-place variant for a card/section a role can see but not act on.
 */
export interface AccessDeniedProps {
  title?: string;
  description?: string;
  minHeight?: number;
  action?: ReactNode;
}

export function AccessDenied({
  title = 'You don’t have access to this',
  description = 'Your role doesn’t permit this action. Contact an administrator if you think that’s wrong.',
  minHeight = 240,
  action,
}: AccessDeniedProps): ReactElement {
  return (
    <QEmptyState
      icon={ShieldX}
      title={title}
      description={description}
      minHeight={minHeight}
      action={action}
    />
  );
}
