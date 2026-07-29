import { POLICY_ACTIONS, type Visibility } from '@qalam/shared';
import { QButton, QCard, QInput, useToast } from '@qalam/ui';
import { type ReactElement, useState } from 'react';

import { getErrorMessage } from '@/lib/errors';

import { usePublicationActions } from '../hooks/use-publishing';
import { isNotApproved } from '../hooks/use-review';
import { VISIBILITY_OPTIONS, visibilityLabel } from '../lib/publishing-labels';
import { CapabilityGate } from './capability-gate';

/**
 * Publish / unpublish / schedule / visibility (AF6, W3c — docs/49 §5).
 *
 * The whole card is gated on `publication.publish`, which the capability endpoint did not explain
 * until the AF6 capability set grew to 12 actions — before that this card rendered with **no
 * controls at all**, on both clients (defect C-2).
 *
 * Three contract facts shape the requests, all of them paid for by mobile:
 *
 * - **Publish and unpublish take no body.** Their handlers declare no `@Body()`, so mobile's
 *   `{visibility, note}` was discarded in silence — the writer's chosen visibility never arrived
 *   (P-8). Visibility is its own call.
 * - **Schedule's key is `scheduledAt`**, not `scheduledFor`, and nothing else is accepted (P-2).
 * - **Visibility is `public | unlisted | private`.** There is no `followers`; offering one is a
 *   guaranteed 400 (P-3).
 */
export interface PublicationCardProps {
  storyId: string;
}

export function PublicationCard({ storyId }: PublicationCardProps): ReactElement {
  const toast = useToast();
  const { publish, unpublish, schedule, changeVisibility } = usePublicationActions(storyId);
  const [when, setWhen] = useState('');
  const [scheduleOpen, setScheduleOpen] = useState(false);

  const busy =
    publish.isPending || unpublish.isPending || schedule.isPending || changeVisibility.isPending;

  const run = async (action: () => Promise<unknown>, message: string): Promise<void> => {
    try {
      await action();
      toast.success(message);
    } catch (error) {
      // A blocked publish is a NAMED state, not a generic failure: an open review has not been
      // approved yet, and saying so is the difference between "try again" and "ask your editor".
      if (isNotApproved(error)) {
        toast.warning('This story is waiting on review', {
          description: 'An open review has to be approved before it can be published.',
        });
        return;
      }
      toast.error('That didn’t work', { description: getErrorMessage(error) });
    }
  };

  return (
    <CapabilityGate storyId={storyId} action={POLICY_ACTIONS.PublicationPublish}>
      <QCard as="section" aria-labelledby="publication-heading">
        <div className="flex flex-col gap-3">
          <h2 id="publication-heading" className="text-ink text-base font-semibold">
            Publication
          </h2>
          <p className="text-ink-secondary text-sm">
            Publishing makes the story visible according to its visibility. Unpublishing returns it
            to a draft.
          </p>

          <div className="flex flex-wrap gap-2">
            <QButton
              size="sm"
              loading={publish.isPending}
              disabled={busy}
              onClick={() => void run(() => publish.mutateAsync(), 'Story published.')}
            >
              Publish
            </QButton>
            <QButton
              size="sm"
              variant="secondary"
              loading={unpublish.isPending}
              disabled={busy}
              onClick={() => void run(() => unpublish.mutateAsync(), 'Story unpublished.')}
            >
              Unpublish
            </QButton>
            <QButton
              size="sm"
              variant="ghost"
              disabled={busy}
              aria-expanded={scheduleOpen}
              onClick={() => setScheduleOpen((open) => !open)}
            >
              Schedule…
            </QButton>
          </div>

          {scheduleOpen ? (
            <div className="flex flex-wrap items-end gap-2">
              <QInput
                label="Publish at"
                aria-label="Publish at"
                type="datetime-local"
                value={when}
                onChange={(event) => setWhen(event.target.value)}
                hint="Must be in the future."
              />
              <QButton
                size="sm"
                loading={schedule.isPending}
                disabled={busy || when === ''}
                onClick={() =>
                  void run(async () => {
                    // The wire wants an ISO-8601 instant; a `datetime-local` value is local wall
                    // time with no zone, so it is converted rather than sent as typed.
                    await schedule.mutateAsync(new Date(when).toISOString());
                    setScheduleOpen(false);
                  }, 'Publish scheduled.')
                }
              >
                Schedule
              </QButton>
            </div>
          ) : null}

          <div className="flex flex-col gap-2">
            <h3 className="text-ink-secondary text-sm font-medium">Visibility</h3>
            <div className="flex flex-wrap gap-1" role="group" aria-label="Story visibility">
              {VISIBILITY_OPTIONS.map((visibility: Visibility) => (
                <QButton
                  key={visibility}
                  size="sm"
                  variant="secondary"
                  disabled={busy}
                  onClick={() =>
                    void run(
                      () => changeVisibility.mutateAsync(visibility),
                      `Visibility set to ${visibilityLabel(visibility)}.`,
                    )
                  }
                >
                  {visibilityLabel(visibility)}
                </QButton>
              ))}
            </div>
          </div>
        </div>
      </QCard>
    </CapabilityGate>
  );
}
