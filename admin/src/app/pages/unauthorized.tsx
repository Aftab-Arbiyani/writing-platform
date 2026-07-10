import { QButton, QEmptyState } from '@qalam/ui';
import { LogIn } from 'lucide-react';
import type { ReactElement } from 'react';
import { useNavigate } from 'react-router';

import { usePageTitle } from '@/hooks/use-page-title';
import { ROUTES } from '@/lib/routes';

/**
 * 401 — sign-in required (docs/11 §6). In practice the api-client + guards route unauthenticated
 * users to /login; this standalone page exists for direct navigation / deep links to `/401`.
 */
export function Unauthorized(): ReactElement {
  usePageTitle('Sign in required');
  const navigate = useNavigate();
  return (
    <QEmptyState
      icon={LogIn}
      title="Please sign in to continue."
      description="This area is part of the admin console and needs an authenticated session."
      minHeight={420}
      action={
        <QButton variant="primary" onClick={() => void navigate(ROUTES.login)}>
          Sign in
        </QButton>
      }
    />
  );
}
