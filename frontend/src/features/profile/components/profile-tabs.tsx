import { cn } from '@umberleaf/ui';
import type { ReactElement } from 'react';

import type { ProfileTab } from '../types/profile.types';

const TABS: readonly { key: ProfileTab; label: string }[] = [
  { key: 'pieces', label: 'Pieces' },
  { key: 'about', label: 'About' },
];

/**
 * Profile section tabs — Pieces / About (docs/06 §3.5). URL-driven `?tab=` selection is owned by
 * the page; this is the presentational nav. `aria-current` marks the active section (the same
 * accessible pattern as the writer dashboard). Collections is omitted (no public read in `v1`).
 */
export function ProfileTabs({
  active,
  onSelect,
}: {
  active: ProfileTab;
  onSelect: (tab: ProfileTab) => void;
}): ReactElement {
  return (
    <nav aria-label="Profile sections" className="border-b border-line">
      {/* See feed-tabs.tsx: no Tailwind preflight, so the UA list markers and button border
          have to be undone here. */}
      <ul className="my-0 flex list-none gap-1 ps-0">
        {TABS.map(({ key, label }) => {
          const isActive = key === active;
          return (
            <li key={key}>
              <button
                type="button"
                aria-current={isActive ? 'page' : undefined}
                onClick={() => onSelect(key)}
                className={cn(
                  'relative border-0 px-4 py-3 text-sm font-medium transition-colors',
                  isActive ? 'text-ink' : 'text-ink-secondary hover:text-ink',
                )}
              >
                {label}
                {isActive ? (
                  <span
                    aria-hidden
                    className="absolute inset-x-4 bottom-0 h-0.5 rounded-full bg-accent"
                  />
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
