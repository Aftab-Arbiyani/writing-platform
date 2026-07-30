import { QTag, type QTagColor } from '@qalam/ui';
import type { ReactElement } from 'react';

/**
 * Status pill for admin tables (docs/07 §7.6) — wraps the shared `QTag` with a status→tone map so
 * lifecycle values render consistently across sections. Pass an explicit `tone` to override, or a
 * `label` to show text different from the raw status. Tokens only; both themes handled by QTag.
 */
export interface StatusBadgeProps {
  status: string;
  tone?: QTagColor;
  label?: string;
  size?: 'sm' | 'md';
}

/** Common admin lifecycle values → tone. Unknown statuses fall back to neutral. */
const TONE_BY_STATUS: Record<string, QTagColor> = {
  active: 'success',
  published: 'success',
  approved: 'success',
  resolved: 'success',
  verified: 'success',
  pending: 'warning',
  scheduled: 'warning',
  review: 'warning',
  draft: 'neutral',
  archived: 'neutral',
  deactivated: 'neutral',
  suspended: 'danger',
  rejected: 'danger',
  failed: 'danger',
  banned: 'danger',
  info: 'info',
};

export function StatusBadge({ status, tone, label, size = 'sm' }: StatusBadgeProps): ReactElement {
  const resolved = tone ?? TONE_BY_STATUS[status.toLowerCase()] ?? 'neutral';
  return (
    <QTag color={resolved} size={size}>
      {label ?? status}
    </QTag>
  );
}
