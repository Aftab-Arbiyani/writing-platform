import { cn } from '@qalam/ui';
import type { ReactElement } from 'react';

import { useEditorUiStore } from '../stores/editor-ui.store';

const TIME_FMT = new Intl.DateTimeFormat('en', { hour: '2-digit', minute: '2-digit' });

/**
 * Autosave status chip (docs/06 §3.3, docs/12 §5.1). `aria-live="polite"` so it's announced.
 * `saving` → `Saved · 21:04` → `Offline — changes not saved yet` (amber) / `Couldn't save`.
 */
export function SaveStatusIndicator(): ReactElement | null {
  const status = useEditorUiStore((s) => s.saveStatus);
  const lastSavedAt = useEditorUiStore((s) => s.lastSavedAt);

  let text = '';
  let tone = 'text-ink-muted';
  switch (status) {
    case 'saving':
      text = 'Saving…';
      break;
    case 'saved':
      text = lastSavedAt ? `Saved · ${TIME_FMT.format(lastSavedAt)}` : 'Saved';
      break;
    case 'offline-error':
      text = 'Offline — changes not saved yet';
      tone = 'text-warning';
      break;
    case 'error':
      text = 'Couldn’t save — will retry';
      tone = 'text-warning';
      break;
    default:
      text = '';
  }

  if (!text) return null;
  return (
    <span role="status" aria-live="polite" className={cn('text-xs', tone)}>
      {text}
    </span>
  );
}
