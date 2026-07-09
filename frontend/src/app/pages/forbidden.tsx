import { QButton, QEmptyState, QPageContainer } from '@qalam/ui';
import { ShieldX } from 'lucide-react';
import type { ReactElement } from 'react';
import { useNavigate } from 'react-router';

import { usePageTitle } from '@/hooks/use-page-title';
import { ROUTES } from '@/lib/routes';

/** 403 — identity known, access denied. Honest deny, not a redirect (docs/11 §4). */
export function Forbidden(): ReactElement {
  const navigate = useNavigate();
  usePageTitle('No access');
  return (
    <QPageContainer className="py-16">
      <QEmptyState
        icon={ShieldX}
        title="You don't have access to this."
        description="If you think this is a mistake, reach out to support."
        action={
          <QButton
            variant="secondary"
            onClick={() => {
              void navigate(ROUTES.feed);
            }}
          >
            Back to the feed
          </QButton>
        }
      />
    </QPageContainer>
  );
}
