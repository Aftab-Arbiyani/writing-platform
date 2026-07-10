import { QEmptyState } from '@qalam/ui';
import { SearchX, WifiOff } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactElement } from 'react';

import { useAppStore } from '@/stores/app.store';

/**
 * "No results" (docs/06 §4.4 catalogue) — literary voice, one honest promise about what the FTS
 * actually matches (exact + fuzzy, no stemming; never "smart" search). When the device is
 * offline we say so instead of blaming the query. Copy defaults come from the catalogue; callers
 * override per group ("No writers…", "No tags…").
 */
export function NoResults({
  title = 'Nothing found yet.',
  description = 'Try a different spelling — we match Hindi, Urdu, and English exactly.',
  icon = SearchX,
}: {
  title?: string;
  description?: string;
  icon?: LucideIcon;
}): ReactElement {
  const isOnline = useAppStore((s) => s.isOnline);

  if (!isOnline) {
    return (
      <QEmptyState
        icon={WifiOff}
        title="You're offline."
        description="Search needs a connection. We'll pick up where you left off when you're back."
      />
    );
  }

  return <QEmptyState icon={icon} title={title} description={description} />;
}
