import { QButton } from '@qalam/ui';
import { X } from 'lucide-react';
import type { ReactElement, ReactNode } from 'react';

/**
 * Appears above/below a table when rows are selected (pairs with `useBulkSelection`). Shows the
 * selection count, the caller's bulk-action buttons, and a clear affordance. Renders nothing when
 * the selection is empty. `role="region"` + a live count so screen readers announce the selection.
 */
export interface BulkActionBarProps {
  selectedCount: number;
  onClear: () => void;
  /** Bulk action buttons (e.g. Suspend, Delete). */
  children?: ReactNode;
  /** Singular noun for the count label, e.g. "user" → "3 users selected". */
  itemLabel?: string;
}

export function BulkActionBar({
  selectedCount,
  onClear,
  children,
  itemLabel = 'item',
}: BulkActionBarProps): ReactElement | null {
  if (selectedCount === 0) return null;
  const noun = selectedCount === 1 ? itemLabel : `${itemLabel}s`;

  return (
    <div
      role="region"
      aria-label="Bulk actions"
      className="flex flex-wrap items-center gap-3 rounded-md border border-line bg-surface px-3 py-2 shadow-sm"
    >
      <span aria-live="polite" className="text-sm font-medium text-ink">
        {selectedCount} {noun} selected
      </span>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
      <QButton variant="ghost" size="sm" icon={X} onClick={onClear} className="ms-auto">
        Clear
      </QButton>
    </div>
  );
}
