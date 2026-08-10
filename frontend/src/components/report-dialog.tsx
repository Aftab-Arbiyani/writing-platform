import { ReportEntityType, ReportReason } from '@qalam/shared';
import { QButton, QDialog, QTextArea, useToast } from '@qalam/ui';
import { type ReactElement, useState } from 'react';

import {
  REPORT_DESCRIPTION_MAX,
  REPORT_REASON_LABELS,
  REPORT_REASONS,
  useReport,
} from '@/hooks/use-report';
import { getErrorMessage } from '@/lib/errors';

/**
 * The one report control (W7b, docs/45 §4.4) — generalized over `ReportEntityType` so a single
 * component serves a piece, a comment, a response and a user.
 *
 * **One component, four mount points, deliberately.** `ReportEntityType` is polymorphic on the
 * wire and `POST /reports` takes the same body whatever the target, so four bespoke dialogs would
 * be four places for the reason catalogue and the 1000-char rule to drift apart. Mobile reached the
 * same conclusion in M7 (`report_sheet.dart` is one sheet); this is the web counterpart.
 *
 * App level (docs/26 §4): the mount points span the reader, the app-level conversation surfaces,
 * and the profile.
 *
 * **The confirmation is honest.** Filing a report does not remove anything or resolve anything —
 * `status` comes back `pending` and a moderator decides later. So the toast says it has been sent
 * for review, never that it has been actioned. The reporter has no further surface here: there is no
 * "my reports" list, and appeals (`POST /reports/:id/appeal`) are subject-only and out of scope.
 */
export interface ReportDialogProps {
  open: boolean;
  onClose: () => void;
  entityType: ReportEntityType;
  entityId: string;
  /** What is being reported, for the dialog title — e.g. "this piece", "@meera_k". */
  subject: string;
}

/** Per-type wording, so the dialog never says "this piece" over a comment. */
const WHAT: Record<ReportEntityType, string> = {
  [ReportEntityType.Piece]: 'this piece',
  [ReportEntityType.Comment]: 'this comment',
  [ReportEntityType.Response]: 'this response',
  [ReportEntityType.User]: 'this person',
};

export function ReportDialog({
  open,
  onClose,
  entityType,
  entityId,
  subject,
}: ReportDialogProps): ReactElement {
  const toast = useToast();
  const report = useReport();
  const [reason, setReason] = useState<ReportReason>(ReportReason.Spam);
  const [description, setDescription] = useState('');

  const tooLong = description.trim().length > REPORT_DESCRIPTION_MAX;
  // Encouraged, never required: `CreateReportDto` marks `description` optional even for `other`,
  // so blocking submit would refuse a report the server would happily take.
  const wantsDetail = reason === ReportReason.Other && description.trim().length === 0;

  const close = (): void => {
    setReason(ReportReason.Spam);
    setDescription('');
    onClose();
  };

  const submit = (): void => {
    if (tooLong) return;
    const trimmed = description.trim();
    report.mutate(
      {
        entityType,
        entityId,
        reason,
        ...(trimmed === '' ? {} : { description: trimmed }),
      },
      {
        onSuccess: () => {
          toast.success('Report sent for review', {
            description: 'A moderator will look at it. Thanks for flagging it.',
          });
          close();
        },
        onError: (err) => {
          toast.error('Couldn’t send the report', { description: getErrorMessage(err) });
        },
      },
    );
  };

  return (
    <QDialog
      open={open}
      onClose={close}
      title={`Report ${WHAT[entityType]}`}
      description={`Tell us what’s wrong with ${subject}. Reports go to a moderator — nothing changes straight away.`}
      size="md"
      footer={
        <div className="flex justify-end gap-2">
          <QButton variant="ghost" onClick={close}>
            Cancel
          </QButton>
          <QButton loading={report.isPending} disabled={tooLong} onClick={submit}>
            Send report
          </QButton>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {/* A radiogroup, not a select: ten short options a reader should be able to compare at a
            glance, and the reason is the substance of the report rather than a form detail. */}
        <fieldset className="flex flex-col gap-2">
          <legend className="text-ink mb-1 text-sm font-medium">Why are you reporting it?</legend>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Reason">
            {REPORT_REASONS.map((option) => {
              const selected = option === reason;
              return (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setReason(option)}
                  className={
                    selected
                      ? 'border-accent bg-accent/10 text-accent rounded-full border px-3 py-1 text-sm'
                      : 'border-line text-ink-secondary hover:border-accent rounded-full border px-3 py-1 text-sm'
                  }
                >
                  {REPORT_REASON_LABELS[option]}
                </button>
              );
            })}
          </div>
        </fieldset>

        <QTextArea
          label="Anything else? (optional)"
          placeholder="What should the moderator know?"
          value={description}
          rows={3}
          onChange={(event) => setDescription(event.target.value)}
          hint={
            wantsDetail
              ? 'A sentence or two helps a lot when the reason is “Something else”.'
              : undefined
          }
          error={
            tooLong
              ? `Keep it under ${REPORT_DESCRIPTION_MAX.toLocaleString('en')} characters.`
              : undefined
          }
        />
      </div>
    </QDialog>
  );
}
