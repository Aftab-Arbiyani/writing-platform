import { cn } from '@qalam/ui';
import type { ReactElement } from 'react';

import type { FeedTab } from '@/lib/query-keys';

/** Order per docs/06 §3.1. Following first for readers; Discover last (visitor default). */
const TABS: readonly { tab: FeedTab; label: string }[] = [
  { tab: 'following', label: 'Following' },
  { tab: 'trending', label: 'Trending' },
  { tab: 'latest', label: 'Latest' },
  { tab: 'discover', label: 'Discover' },
];

/**
 * Feed section switcher (docs/06 §3.1) — the tab lives in the URL, so these are navigational
 * (each a focus stop; `aria-current="page"` marks the active one). Sticky under the top bar; a
 * horizontally scrollable, swipeable bar on mobile (docs/06 §11.2).
 */
export function FeedTabs({
  tab,
  onSelect,
}: {
  tab: FeedTab;
  onSelect: (tab: FeedTab) => void;
}): ReactElement {
  return (
    <nav
      aria-label="Feed sections"
      className="border-line sticky top-14 z-10 border-b bg-canvas/95 backdrop-blur sm:top-16"
    >
      <ul className="flex gap-1 overflow-x-auto">
        {TABS.map(({ tab: value, label }) => {
          const active = value === tab;
          return (
            <li key={value}>
              <button
                type="button"
                onClick={() => {
                  onSelect(value);
                }}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative whitespace-nowrap px-3 py-3 text-sm font-medium transition-colors',
                  active ? 'text-ink' : 'text-ink-secondary hover:text-ink',
                )}
              >
                {label}
                {active ? (
                  <span
                    aria-hidden
                    className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-accent"
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
