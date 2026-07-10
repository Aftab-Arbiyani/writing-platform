import { Search } from 'lucide-react';
import type { ReactElement } from 'react';

import { useSearchStore } from '../stores/search.store';
import { IS_MAC } from './command-palette';

/**
 * The top-bar search affordance (docs/06 §2) — a button shaped like a search box that OPENS the
 * command palette (GitHub/Linear pattern) rather than searching inline. Shows the ⌘K / Ctrl K
 * hint so the shortcut is discoverable. Desktop only (md+); mobile reaches search via the bottom
 * tab bar's Search destination.
 */
export function CommandTrigger(): ReactElement {
  const openCommand = useSearchStore((s) => s.openCommand);

  return (
    <button
      type="button"
      onClick={openCommand}
      aria-label="Open search (Command K)"
      aria-haspopup="dialog"
      className="border-line flex h-9 w-full items-center gap-2 rounded-md border bg-surface px-3 text-sm text-ink-muted transition-colors hover:border-ink-muted hover:text-ink-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      <Search size={16} strokeWidth={1.75} aria-hidden />
      <span className="flex-1 text-start">Search writers, pieces, tags…</span>
      <kbd className="border-line hidden items-center rounded border bg-raised px-1.5 py-0.5 font-mono text-[11px] text-ink-muted sm:inline-flex">
        {IS_MAC ? '⌘K' : 'Ctrl K'}
      </kbd>
    </button>
  );
}
