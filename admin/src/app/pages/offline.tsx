import { QButton, QEmptyState } from '@qalam/ui';
import { WifiOff } from 'lucide-react';
import type { ReactElement } from 'react';

import { usePageTitle } from '@/hooks/use-page-title';

/**
 * Offline surface (docs/11 §6). The console needs the network; there is no offline mode. Reconnect
 * and retry.
 */
export function Offline(): ReactElement {
  usePageTitle('Offline');
  return (
    <QEmptyState
      icon={WifiOff}
      title="You’re offline."
      description="The admin console needs a connection. Check your network and try again."
      minHeight={420}
      action={
        <QButton variant="secondary" onClick={() => window.location.reload()}>
          Try again
        </QButton>
      }
    />
  );
}
