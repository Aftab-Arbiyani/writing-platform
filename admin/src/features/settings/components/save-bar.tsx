import { QButton } from '@qalam/ui';
import { RotateCcw, Save } from 'lucide-react';
import type { ReactElement } from 'react';

interface SaveBarProps {
  /** Number of unsaved fields (drives the label + visibility). */
  dirtyCount: number;
  saving: boolean;
  onSave: () => void;
  onReset: () => void;
}

/**
 * Sticky action bar (A7) shown while a settings form has unsaved edits. Announces
 * the dirty count (aria-live) and offers Reset + Save. Sits at the bottom of the
 * section so it stays reachable on long forms and on mobile.
 */
export function SaveBar({
  dirtyCount,
  saving,
  onSave,
  onReset,
}: SaveBarProps): ReactElement | null {
  if (dirtyCount === 0) {
    return null;
  }
  return (
    <div
      className="sticky bottom-0 z-10 mt-4 flex items-center justify-between gap-3 rounded-lg border border-line bg-surface/95 px-4 py-3 shadow-lg backdrop-blur"
      role="region"
      aria-label="Unsaved changes"
    >
      <p className="text-sm text-ink-secondary" aria-live="polite">
        {dirtyCount} unsaved {dirtyCount === 1 ? 'change' : 'changes'}
      </p>
      <div className="flex items-center gap-2">
        <QButton variant="secondary" size="sm" icon={RotateCcw} onClick={onReset} disabled={saving}>
          Reset
        </QButton>
        <QButton variant="primary" size="sm" icon={Save} onClick={onSave} loading={saving}>
          Save changes
        </QButton>
      </div>
    </div>
  );
}
