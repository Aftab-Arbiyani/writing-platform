import { QButton, QSkeleton, QTag, useConfirm, useToast } from '@qalam/ui';
import type { ReactElement } from 'react';

import { getErrorMessage } from '@/lib/errors';
import { formatDate } from '@/lib/format';

import { useBlockActions, useMyBlocks } from '../hooks/use-trust';
import type { BlockEntry } from '../types/collaboration.types';
import { CollaboratorIdentity } from './collaborator-identity';

/**
 * The viewer's blocks and mutes (AF6, W3c — docs/49 §5).
 *
 * **Built from the DTOs; mobile has no such screen.** Its data layer is complete and reaches nothing
 * (docs/48 §3.3), so this is the first working version on any client — and the mobile defect in that
 * dead code is the trap this list has to avoid: `BlockDto.id` is the **relationship's** id, while
 * `blockedId` is the user. Mobile read neither and fell through to the row id, so every
 * `DELETE /users/:id/block` reached the service with the wrong UUID and 404'd — unblocking could
 * never work (**T-1**). Removal here passes `entry.blockedId`, and a unit test pins it.
 *
 * Both kinds live in one list because one endpoint returns both, distinguished by `kind`. They are
 * genuinely different promises — a block severs interaction both ways, a mute only hides someone
 * from the viewer — so each row says which it is and removal calls the matching route.
 */
export function BlockList(): ReactElement {
  const toast = useToast();
  const confirm = useConfirm();
  const blocks = useMyBlocks();
  const { unblock, unmute } = useBlockActions();

  const busy = unblock.isPending || unmute.isPending;

  const remove = async (entry: BlockEntry): Promise<void> => {
    const isMute = entry.kind === 'mute';
    const ok = await confirm({
      title: isMute ? 'Unmute this person?' : 'Unblock this person?',
      content: isMute
        ? 'Their writing will appear in your feed again.'
        : 'You will both be able to see and interact with each other again.',
      okText: isMute ? 'Unmute' : 'Unblock',
    });
    if (!ok) return;
    try {
      // `blockedId` — the USER. Passing `entry.id` is defect T-1 and always 404s.
      await (isMute ? unmute.mutateAsync(entry.blockedId) : unblock.mutateAsync(entry.blockedId));
      toast.success(isMute ? 'Unmuted.' : 'Unblocked.');
    } catch (error) {
      toast.error('That didn’t work', { description: getErrorMessage(error) });
    }
  };

  if (blocks.isLoading) {
    return (
      <div role="status" aria-busy="true" aria-label="Loading blocked people">
        <QSkeleton variant="text" lines={3} />
      </div>
    );
  }

  if (blocks.isError) {
    return (
      <p role="alert" className="text-danger text-sm">
        Couldn’t load your blocked list. {getErrorMessage(blocks.error)}
      </p>
    );
  }

  if ((blocks.data?.length ?? 0) === 0) {
    return (
      <p className="text-ink-muted text-sm">
        You haven’t blocked or muted anyone. You can block someone from their profile.
      </p>
    );
  }

  return (
    <ul className="divide-line flex flex-col divide-y">
      {blocks.data?.map((entry) => (
        <li key={entry.id} className="flex flex-wrap items-center gap-3 py-3">
          <div className="min-w-0 flex-1">
            <CollaboratorIdentity userId={entry.blockedId} />
          </div>
          <QTag color={entry.kind === 'mute' ? 'neutral' : 'danger'} size="sm">
            {entry.kind === 'mute' ? 'Muted' : 'Blocked'}
          </QTag>
          <span className="text-ink-muted text-xs">{formatDate(entry.createdAt)}</span>
          <QButton size="sm" variant="ghost" disabled={busy} onClick={() => void remove(entry)}>
            {entry.kind === 'mute' ? 'Unmute' : 'Unblock'}
          </QButton>
        </li>
      ))}
    </ul>
  );
}
