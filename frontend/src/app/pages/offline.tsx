import { QButton, QEmptyState, QPageContainer } from '@qalam/ui';
import { WifiOff } from 'lucide-react';
import type { ReactElement } from 'react';

import { usePageTitle } from '@/hooks/use-page-title';

/** Offline surface (docs/06 §4.5). No offline mode — reconnect and retry; work is safe. */
export function Offline(): ReactElement {
  usePageTitle('Offline');
  return (
    <QPageContainer className="py-16">
      <QEmptyState
        icon={WifiOff}
        title="You're offline."
        description="Check your connection — your work is safe. We'll reconnect automatically."
        action={
          <QButton
            variant="secondary"
            onClick={() => {
              window.location.reload();
            }}
          >
            Try again
          </QButton>
        }
      />
    </QPageContainer>
  );
}
