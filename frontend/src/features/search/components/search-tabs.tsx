import { SearchType } from '@qalam/shared';
import { cn } from '@qalam/ui';
import type { ReactElement } from 'react';

/** Group order (docs/06 §3.6): the grouped preview first, then each dedicated group. */
const TABS: readonly { type: SearchType; label: string }[] = [
  { type: SearchType.All, label: 'All' },
  { type: SearchType.Writers, label: 'Writers' },
  { type: SearchType.Pieces, label: 'Pieces' },
  { type: SearchType.Tags, label: 'Tags' },
  { type: SearchType.Genres, label: 'Genres' },
  { type: SearchType.Languages, label: 'Languages' },
];

/**
 * Search scope switcher (docs/06 §3.6). The active scope lives in the URL (`type=`), so these are
 * navigational buttons (each a focus stop; `aria-current` marks the active one). Horizontally
 * scrollable on mobile (docs/06 §11.2). `role="tablist"` semantics are conveyed via `aria-current`
 * on real buttons — no faux-ARIA tab widget to keep keyboard behavior native.
 */
export function SearchTabs({
  type,
  onSelect,
}: {
  type: SearchType;
  onSelect: (type: SearchType) => void;
}): ReactElement {
  return (
    <nav aria-label="Search scope" className="border-line border-b">
      <ul className="-mb-px flex gap-1 overflow-x-auto">
        {TABS.map(({ type: value, label }) => {
          const active = value === type;
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
