import { QEmptyState } from '@qalam/ui';
import { Ban, Gauge, Sparkles } from 'lucide-react';
import type { ReactElement } from 'react';

import { AVAILABILITY_COPY, type AiAvailability } from '../lib/ai-availability';

const ICONS = {
  off: Sparkles,
  'feature-off': Ban,
  quota: Gauge,
} as const;

/**
 * The blocked state of an AI surface (W2/AF2) — off, not enabled for this account, or out of
 * allowance. Renders nothing when the surface is usable or still resolving.
 *
 * The quota case is the one W2 required from day one: it is a routine outcome of metering, so it
 * reads as information rather than failure, and it says explicitly that the writing is unaffected.
 */
export function AiAvailabilityNotice({
  availability,
}: {
  availability: AiAvailability;
}): ReactElement | null {
  if (availability === 'available' || availability === 'unknown') return null;

  const copy = AVAILABILITY_COPY[availability];
  return (
    <QEmptyState
      icon={ICONS[availability]}
      title={copy.title}
      description={copy.description}
      minHeight={220}
    />
  );
}
