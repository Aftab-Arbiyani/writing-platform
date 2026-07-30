import { POLICY_ACTIONS } from '@qalam/shared';
import { QButton, QCard, QTag, QTextArea, useToast } from '@qalam/ui';
import { type ReactElement, useState } from 'react';

import { getErrorMessage } from '@/lib/errors';
import { formatDate } from '@/lib/format';

import { useReviewActions, useStoryReview } from '../hooks/use-review';
import { reviewStateTag } from '../lib/publishing-labels';
import { CapabilityGate } from './capability-gate';
import { CollaboratorIdentity } from './collaborator-identity';

/**
 * The editorial review step (AF6, W3c — docs/49 §5): where a story stands, and the three actions
 * that move it.
 *
 * **A story with no session reads "Draft", not an error.** `GET /stories/:id/review` answers a 200
 * carrying `data: null` for every story before the flow starts (defect P-4), so `null` is the
 * ordinary case this card is built around — review gating is opt-in per story.
 *
 * Gating follows the capability map, and only actions the server actually explains:
 * `story.edit` for requesting a review (an Editor's right), `review.approve` for deciding one.
 * `review.request` exists in the policy catalogue but is **not** in the 12 actions
 * `GET …/capabilities` returns, so gating on it would render nothing at all — which is precisely
 * how defect C-2 hid all five of these controls until the capability set grew.
 */
export interface ReviewCardProps {
  storyId: string;
}

export function ReviewCard({ storyId }: ReviewCardProps): ReactElement {
  const toast = useToast();
  const review = useStoryReview(storyId);
  const { requestReview, approveReview, requestChanges } = useReviewActions(storyId);
  const [notes, setNotes] = useState('');
  const [notesOpen, setNotesOpen] = useState(false);

  const session = review.data ?? null;
  const tag = reviewStateTag(session?.state);
  const busy = requestReview.isPending || approveReview.isPending || requestChanges.isPending;

  const run = async (action: () => Promise<unknown>, message: string): Promise<void> => {
    try {
      await action();
      toast.success(message);
    } catch (error) {
      toast.error('That didn’t work', { description: getErrorMessage(error) });
    }
  };

  return (
    <QCard as="section" aria-labelledby="review-heading">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="review-heading" className="text-ink text-base font-semibold">
            Review
          </h2>
          {review.isLoading ? (
            <span className="text-ink-muted text-xs">Loading…</span>
          ) : (
            <QTag color={tag.color} size="sm">
              {tag.label}
            </QTag>
          )}
        </div>

        <p className="text-ink-secondary text-sm">
          Review is optional per story. A story is gated only while an open review has not been
          approved — with no review, publishing is unchanged.
        </p>

        {review.isError ? (
          <p role="alert" className="text-danger text-sm">
            Couldn’t load the review state. {getErrorMessage(review.error)}
          </p>
        ) : null}

        {session ? (
          <dl className="flex flex-col gap-2 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <dt className="text-ink-muted">Requested by</dt>
              <dd>
                <CollaboratorIdentity userId={session.requestedById} />
              </dd>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <dt className="text-ink-muted">Submitted</dt>
              <dd className="text-ink-secondary">{formatDate(session.submittedAt)}</dd>
            </div>
            {session.notes ? (
              <div className="flex flex-col gap-1">
                <dt className="text-ink-muted">Reviewer notes</dt>
                {/* `notes` is why a review bounced back; mobile sent it under the wrong key and
                    never displayed it (P-5/P-6). */}
                <dd className="text-ink-secondary whitespace-pre-wrap">
                  <bdi>{session.notes}</bdi>
                </dd>
              </div>
            ) : null}
          </dl>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {session?.state !== 'in_review' ? (
            <CapabilityGate storyId={storyId} action={POLICY_ACTIONS.StoryEdit}>
              <QButton
                size="sm"
                loading={requestReview.isPending}
                disabled={busy}
                onClick={() => void run(() => requestReview.mutateAsync(), 'Review requested.')}
              >
                Request review
              </QButton>
            </CapabilityGate>
          ) : null}

          <CapabilityGate storyId={storyId} action={POLICY_ACTIONS.ReviewApprove}>
            <>
              <QButton
                size="sm"
                loading={approveReview.isPending}
                disabled={busy}
                onClick={() => void run(() => approveReview.mutateAsync(), 'Review approved.')}
              >
                Approve
              </QButton>
              <QButton
                size="sm"
                variant="secondary"
                disabled={busy}
                onClick={() => setNotesOpen((open) => !open)}
                aria-expanded={notesOpen}
              >
                Request changes
              </QButton>
            </>
          </CapabilityGate>
        </div>

        {notesOpen ? (
          <div className="flex flex-col gap-2">
            <QTextArea
              label="What should change?"
              aria-label="What should change?"
              rows={3}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              hint="Optional — sent to the author with the decision."
            />
            <div className="flex justify-end gap-2">
              <QButton size="sm" variant="ghost" onClick={() => setNotesOpen(false)}>
                Cancel
              </QButton>
              <QButton
                size="sm"
                loading={requestChanges.isPending}
                onClick={() =>
                  void run(async () => {
                    // `notes`, plural — the key `RequestChangesDto` declares (P-5).
                    await requestChanges.mutateAsync(notes.trim() || undefined);
                    setNotes('');
                    setNotesOpen(false);
                  }, 'Changes requested.')
                }
              >
                Send decision
              </QButton>
            </div>
          </div>
        ) : null}
      </div>
    </QCard>
  );
}
