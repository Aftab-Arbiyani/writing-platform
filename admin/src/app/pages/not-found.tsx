import { QButton, QEmptyState } from '@qalam/ui';
import { Compass } from 'lucide-react';
import type { ReactElement } from 'react';
import { useNavigate } from 'react-router';

import { usePageTitle } from '@/hooks/use-page-title';
import { ROUTES } from '@/lib/routes';

/**
 * 404 (docs/11 §6) — the console's own not-found, rendered inside the shell for any unmatched admin
 * route. No reader-style search; an operator just needs a way back.
 */
export function NotFound(): ReactElement {
  usePageTitle('Not found');
  const navigate = useNavigate();
  return (
    <QEmptyState
      icon={Compass}
      title="This page doesn’t exist."
      description="The admin route may have moved, or you followed a broken link."
      minHeight={420}
      action={
        <QButton variant="primary" onClick={() => void navigate(ROUTES.dashboard)}>
          Back to dashboard
        </QButton>
      }
    />
  );
}
