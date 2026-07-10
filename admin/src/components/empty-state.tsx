import { QEmptyState, type QEmptyStateProps } from '@qalam/ui';
import { Inbox } from 'lucide-react';
import type { ReactElement } from 'react';

/**
 * Admin empty state — the shared `QEmptyState` with an admin-appropriate default icon. Used by
 * `DataTable` and any section with no rows. Reuse over reinvention (docs/03 §5): all the a11y +
 * token work lives in the primitive.
 */
export type EmptyStateProps = QEmptyStateProps;

export function EmptyState({ icon = Inbox, ...rest }: EmptyStateProps): ReactElement {
  return <QEmptyState icon={icon} {...rest} />;
}
