import { QButton, QEmptyState, QPageContainer } from '@qalam/ui';
import { LogIn } from 'lucide-react';
import type { ReactElement } from 'react';
import { useNavigate } from 'react-router';

import { usePageTitle } from '@/hooks/use-page-title';
import { ROUTES } from '@/lib/routes';

/**
 * 401 — sign-in required. In practice the api-client interceptor redirects to login on
 * unauthorized (docs/32 §3); this standalone page exists for direct navigation / deep links.
 */
export function Unauthorized(): ReactElement {
  const navigate = useNavigate();
  usePageTitle('Sign in required');
  return (
    <QPageContainer className="py-16">
      <QEmptyState
        icon={LogIn}
        title="Please sign in to continue."
        description="This page is part of your private space on Qalam."
        action={
          <QButton
            variant="primary"
            onClick={() => {
              void navigate(ROUTES.login);
            }}
          >
            Sign in
          </QButton>
        }
      />
    </QPageContainer>
  );
}
