import { POLICY_ACTIONS } from '@qalam/shared';
import { QButton, QCard, QSkeleton, useConfirm, useToast } from '@qalam/ui';
import type { ReactElement } from 'react';

import { getErrorMessage } from '@/lib/errors';
import { formatDate } from '@/lib/format';

import { useSnapshotActions, useStorySnapshots } from '../hooks/use-snapshots';
import { snapshotReasonLabel } from '../lib/publishing-labels';
import { CapabilityGate } from './capability-gate';

/**
 * A story's version history — capture and revert (AF6, W3c — docs/49 §5).
 *
 * A version has **no label**: the create handler takes no body and hard-codes `reason: manual`, so
 * the `label` mobile sent was discarded and its list showed an invented name for a field the wire
 * never carried (defects P-7/P-8). What identifies a version is `version` + `reason` + when it was
 * taken, which is what this renders.
 *
 * Revert is confirmed before it runs. It rewrites the live piece — the one destructive action on
 * this page — and unlike publishing it cannot be undone by pressing the opposite button.
 */
export interface SnapshotListProps {
  storyId: string;
}

export function SnapshotList({ storyId }: SnapshotListProps): ReactElement {
  const toast = useToast();
  const confirm = useConfirm();
  const snapshots = useStorySnapshots(storyId);
  const { createSnapshot, revert } = useSnapshotActions(storyId);

  const busy = createSnapshot.isPending || revert.isPending;

  const capture = async (): Promise<void> => {
    try {
      await createSnapshot.mutateAsync();
      toast.success('Snapshot captured.');
    } catch (error) {
      toast.error('Couldn’t capture a snapshot', { description: getErrorMessage(error) });
    }
  };

  const revertTo = async (snapshotId: string, version: number): Promise<void> => {
    const ok = await confirm({
      title: `Revert to version ${String(version)}?`,
      content:
        'The story’s current text is replaced by this version. A version of the current text is kept, so this can be reverted in turn.',
      okText: 'Revert',
      danger: true,
    });
    if (!ok) return;
    try {
      await revert.mutateAsync(snapshotId);
      toast.success(`Reverted to version ${String(version)}.`);
    } catch (error) {
      toast.error('Couldn’t revert', { description: getErrorMessage(error) });
    }
  };

  return (
    <QCard as="section" aria-labelledby="snapshots-heading">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="snapshots-heading" className="text-ink text-base font-semibold">
            Versions
          </h2>
          <CapabilityGate storyId={storyId} action={POLICY_ACTIONS.StoryEdit}>
            <QButton
              size="sm"
              variant="secondary"
              loading={createSnapshot.isPending}
              disabled={busy}
              onClick={() => void capture()}
            >
              Capture version
            </QButton>
          </CapabilityGate>
        </div>

        {snapshots.isLoading ? (
          <div role="status" aria-busy="true" aria-label="Loading versions">
            <QSkeleton variant="text" lines={2} />
          </div>
        ) : snapshots.isError ? (
          <p role="alert" className="text-danger text-sm">
            Couldn’t load the versions. {getErrorMessage(snapshots.error)}
          </p>
        ) : (snapshots.data?.length ?? 0) === 0 ? (
          <p className="text-ink-muted text-sm">
            No versions yet. One is captured automatically on publish, and before an accepted
            suggestion rewrites the text.
          </p>
        ) : (
          <ul className="divide-line flex flex-col divide-y">
            {snapshots.data?.map((snapshot) => (
              <li key={snapshot.id} className="flex flex-wrap items-center gap-2 py-2">
                <div className="min-w-0 flex-1">
                  <p className="text-ink text-sm font-medium">
                    Version {snapshot.version}
                    <span className="text-ink-muted font-normal">
                      {' · '}
                      {snapshotReasonLabel(snapshot.reason)}
                    </span>
                  </p>
                  <p className="text-ink-muted text-xs">
                    {formatDate(snapshot.createdAt)} · {snapshot.wordCount} words
                  </p>
                </div>
                <CapabilityGate storyId={storyId} action={POLICY_ACTIONS.StoryEdit}>
                  <QButton
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => void revertTo(snapshot.id, snapshot.version)}
                  >
                    Revert
                  </QButton>
                </CapabilityGate>
              </li>
            ))}
          </ul>
        )}
      </div>
    </QCard>
  );
}
