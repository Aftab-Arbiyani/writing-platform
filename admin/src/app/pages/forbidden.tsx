import { QButton, QEmptyState } from '@qalam/ui';
import { ShieldX } from 'lucide-react';
import type { ReactElement } from 'react';
import { useNavigate } from 'react-router';

import { usePageTitle } from '@/hooks/use-page-title';
import { ROUTES } from '@/lib/routes';
import { useAuthStore } from '@/stores/auth.store';

/**
 * 403 (docs/11 §4) — an honest deny when the role rank is below a section's floor. Rendered by
 * `RequireRole` (in place of the branch) and by the `/403` route. Offers a way back to the
 * dashboard and a sign-out (for the console-floor case where nothing is accessible).
 */
export function Forbidden(): ReactElement {
  usePageTitle('No access');
  const navigate = useNavigate();
  const clearSession = useAuthStore((state) => state.clearSession);

  return (
    <QEmptyState
      icon={ShieldX}
      title="You don’t have access to this."
      description="Your role doesn’t permit this area. If you think that’s wrong, contact an administrator."
      minHeight={420}
      action={
        <div className="flex items-center gap-2">
          <QButton variant="secondary" onClick={() => void navigate(ROUTES.dashboard)}>
            Back to dashboard
          </QButton>
          <QButton variant="ghost" onClick={() => clearSession()}>
            Sign out
          </QButton>
        </div>
      }
    />
  );
}
