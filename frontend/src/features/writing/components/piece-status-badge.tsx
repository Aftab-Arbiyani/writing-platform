import { PieceStatus } from '@umberleaf/shared';
import { QTag, type QTagColor } from '@umberleaf/ui';
import type { ReactElement } from 'react';

const MAP: Record<PieceStatus, { label: string; color: QTagColor }> = {
  [PieceStatus.Draft]: { label: 'Draft', color: 'neutral' },
  [PieceStatus.Scheduled]: { label: 'Scheduled', color: 'info' },
  [PieceStatus.Published]: { label: 'Published', color: 'success' },
  [PieceStatus.Archived]: { label: 'Archived', color: 'warning' },
};

/** Piece status pill for the writer dashboard. */
export function PieceStatusBadge({ status }: { status: PieceStatus }): ReactElement {
  const { label, color } = MAP[status];
  return (
    <QTag color={color} size="sm">
      {label}
    </QTag>
  );
}
