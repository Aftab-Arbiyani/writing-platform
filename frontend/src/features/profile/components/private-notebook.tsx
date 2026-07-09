import { QEmptyState } from '@qalam/ui';
import { Lock } from 'lucide-react';
import type { ReactElement } from 'react';

/**
 * Locked state for a private account viewed by a non-follower (docs/06 §3.5, §4.4 — exact copy).
 * The action lives in the header's Follow button ("Request to follow"); we never tease a count of
 * hidden pieces.
 */
export function PrivateNotebook(): ReactElement {
  return (
    <QEmptyState
      icon={Lock}
      title="This writer keeps a private notebook."
      description="Follow to request access to their pieces."
      minHeight={280}
    />
  );
}
