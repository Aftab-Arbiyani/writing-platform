import { QButton } from '@qalam/ui';
import { Clock, Trash2 } from 'lucide-react';
import type { ReactElement } from 'react';

import { useRecentSearches } from '../hooks/use-recent-searches';
import { RemovableChip } from './search-chip';

/**
 * Recent searches (docs/06 §3.6) — the signed-in user's server list, or the device-local list
 * for visitors (`useRecentSearches` unifies both). Each chip re-runs its query; the ✕ forgets
 * it; "Clear all" empties the list. Renders nothing when there is no history (the caller shows
 * trending instead), so it never occupies space with an empty shell.
 */
export function RecentSearches({ onRun }: { onRun: (query: string) => void }): ReactElement | null {
  const { items, remove, clear } = useRecentSearches();

  if (items.length === 0) return null;

  return (
    <section aria-labelledby="recent-searches-heading" className="flex flex-col gap-3">
      <header className="flex items-center justify-between">
        <h2 id="recent-searches-heading" className="text-sm font-semibold text-ink">
          Recent
        </h2>
        <QButton variant="ghost" size="sm" icon={Trash2} onClick={clear}>
          Clear all
        </QButton>
      </header>
      <ul className="flex flex-wrap gap-2">
        {items.map((item) => (
          <li key={item.id}>
            <RemovableChip
              icon={Clock}
              label={item.query}
              onClick={() => {
                onRun(item.query);
              }}
              onRemove={() => {
                remove(item);
              }}
              removeLabel={`Remove “${item.query}” from recent searches`}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
