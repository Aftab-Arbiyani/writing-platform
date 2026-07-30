import { Info } from 'lucide-react';
import type { ReactElement } from 'react';

/**
 * The always-visible permanence callout beneath the username field (docs/06 §3.7). Username is
 * a permanent, URL-safe identity (ADR §4) — no edit path is ever built. The pen name (shown on
 * work) is the changeable display name, and lives on the profile (E2).
 */
export function UsernamePermanenceCallout(): ReactElement {
  return (
    <div className="flex items-start gap-2 rounded-md border border-info/30 bg-info/10 px-3 py-2.5 text-xs text-ink-secondary">
      <Info size={16} strokeWidth={1.75} className="mt-0.5 shrink-0 text-info" aria-hidden />
      <p>
        <strong className="font-medium text-ink">Your username is permanent.</strong> Like ink, it
        can’t be unwritten. Your pen name, shown on your work, can change anytime.
      </p>
    </div>
  );
}
