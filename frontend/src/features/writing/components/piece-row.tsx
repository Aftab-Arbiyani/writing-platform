import { PieceStatus } from '@qalam/shared';
import { QButton, QCard, useConfirm, useToast } from '@qalam/ui';
import { Archive, ArchiveRestore, Copy, ExternalLink, PenLine, Trash2 } from 'lucide-react';
import type { ReactElement } from 'react';
import { useNavigate } from 'react-router';

import { formatDate, formatReadingTime, formatRelativeTime } from '@/lib/format';
import { getErrorMessage } from '@/lib/errors';
import { mediaUrl } from '@/lib/media';
import { piecePath, ROUTES } from '@/lib/routes';

import {
  useArchivePiece,
  useDeletePiece,
  useDuplicatePiece,
  useUnarchivePiece,
} from '../hooks/use-piece-mutations';
import type { PieceListItem } from '../types/piece.types';
import { PieceStatusBadge } from './piece-status-badge';

/** A row in the writer dashboard with its lifecycle actions. */
export function PieceRow({ item }: { item: PieceListItem }): ReactElement {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const toast = useToast();
  const del = useDeletePiece();
  const duplicate = useDuplicatePiece();
  const archive = useArchivePiece();
  const unarchive = useUnarchivePiece();

  const editPath = `${ROUTES.write}/${item.id}`;
  const cover = mediaUrl(item.coverImageKey);

  const meta =
    item.status === PieceStatus.Published && item.publishedAt
      ? `Published ${formatRelativeTime(item.publishedAt)}`
      : item.status === PieceStatus.Scheduled && item.scheduledAt
        ? `Scheduled for ${formatDate(item.scheduledAt)}`
        : `Edited ${formatRelativeTime(item.updatedAt)}`;

  const onDelete = async (): Promise<void> => {
    const confirmed = await confirm({
      title: 'Delete this piece?',
      content: 'This can’t be undone.',
      okText: 'Delete',
      cancelText: 'Keep',
      danger: true,
    });
    if (!confirmed) return;
    del.mutate(item.id, {
      onSuccess: () => {
        toast.success('Piece deleted');
      },
      onError: (err) => {
        toast.error('Couldn’t delete', { description: getErrorMessage(err) });
      },
    });
  };

  return (
    <QCard as="li" padding="md" className="flex items-center gap-4">
      {cover ? (
        <img
          src={cover}
          alt=""
          className="hidden size-16 shrink-0 rounded-md object-cover sm:block"
        />
      ) : null}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate font-serif text-lg font-medium text-ink">
            {item.title || 'Untitled'}
          </h3>
          <PieceStatusBadge status={item.status} />
        </div>
        <p className="mt-0.5 text-xs text-ink-muted tabular-nums">
          {meta} · {formatReadingTime(item.readingTimeSeconds)} · {item.wordCount} words
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        {item.status === PieceStatus.Published && item.slug ? (
          <QButton
            variant="ghost"
            size="sm"
            icon={ExternalLink}
            aria-label="View published piece"
            onClick={() => {
              if (item.slug) void navigate(piecePath(item.slug));
            }}
          />
        ) : null}
        <QButton
          variant="ghost"
          size="sm"
          icon={PenLine}
          aria-label="Edit"
          onClick={() => {
            void navigate(editPath);
          }}
        />
        <QButton
          variant="ghost"
          size="sm"
          icon={Copy}
          aria-label="Duplicate"
          loading={duplicate.isPending}
          onClick={() => {
            duplicate.mutate(item.id, {
              onSuccess: (piece) => {
                toast.success('Draft duplicated');
                void navigate(`${ROUTES.write}/${piece.id}`);
              },
              onError: (err) => {
                toast.error('Couldn’t duplicate', { description: getErrorMessage(err) });
              },
            });
          }}
        />
        {item.status === PieceStatus.Published ? (
          <QButton
            variant="ghost"
            size="sm"
            icon={Archive}
            aria-label="Archive"
            loading={archive.isPending}
            onClick={() => {
              archive.mutate(item.id, {
                onSuccess: () => {
                  toast.success('Piece archived');
                },
                onError: (err) => {
                  toast.error('Couldn’t archive', { description: getErrorMessage(err) });
                },
              });
            }}
          />
        ) : null}
        {item.status === PieceStatus.Archived ? (
          <QButton
            variant="ghost"
            size="sm"
            icon={ArchiveRestore}
            aria-label="Unarchive"
            loading={unarchive.isPending}
            onClick={() => {
              unarchive.mutate(item.id, {
                onSuccess: () => {
                  toast.success('Piece restored');
                },
                onError: (err) => {
                  toast.error('Couldn’t restore', { description: getErrorMessage(err) });
                },
              });
            }}
          />
        ) : null}
        <QButton
          variant="ghost"
          size="sm"
          icon={Trash2}
          aria-label="Delete"
          loading={del.isPending}
          onClick={() => {
            void onDelete();
          }}
        />
      </div>
    </QCard>
  );
}
