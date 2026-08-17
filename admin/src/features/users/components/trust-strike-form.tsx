import { StrikeSeverity } from '@qalam/shared';
import { QButton, QCard, QSectionHeader, useToast } from '@qalam/ui';
import { useState, type ReactElement } from 'react';

import { ConfirmationDialog } from '@/components/confirmation-dialog';
import { getErrorMessage } from '@/lib/errors';

import { useIssueStrike } from '../hooks/use-trust';
import { strikeSeverityLabel } from '../lib/trust-labels';
import { escalationCopy, projectStrike } from '../lib/trust-standing';
import type { AdminRestriction, IssueStrikePayload } from '../types/trust.types';

/**
 * Issue a policy strike (`POST /admin/users/:id/strikes`).
 *
 * **The confirmation exists to stop one specific accident**: an operator issuing what they read as
 * a warning and silently suspending the account. The server auto-escalates inside the same request
 * — at an active weight of 3 it applies a permanent global "Restricted" restriction, at 6 a
 * permanent global "Suspended" one (`trust.service.ts:maybeEscalate`) — and nothing in the request
 * or the response says so. So the dialog states this strike's weight, the projected total, and what
 * happens at each threshold, every time, whether or not this strike crosses one.
 *
 * **There is no undo.** No route revokes a strike (`revokeStrike` exists in the repository with no
 * caller — defect A2-2), and none lists them, so the projected total cannot be checked against the
 * server's own count either. Both facts are in the copy rather than left to be discovered.
 *
 * The severity select is built from `StrikeSeverity` itself, so it can only offer values the
 * server's `@IsIn(Object.values(StrikeSeverity))` accepts.
 */
const SEVERITIES = Object.values(StrikeSeverity);

export interface TrustStrikeFormProps {
  userId: string;
  /** The standing's current active strike weight — the base for the projection. */
  activeStrikeWeight: number;
  /** The standing's ACTIVE restrictions, so the copy can say when escalation is already in force. */
  activeRestrictions: readonly AdminRestriction[];
}

export function TrustStrikeForm({
  userId,
  activeStrikeWeight,
  activeRestrictions,
}: TrustStrikeFormProps): ReactElement {
  const toast = useToast();
  const issue = useIssueStrike();
  const [severity, setSeverity] = useState<StrikeSeverity>(StrikeSeverity.Minor);
  const [reason, setReason] = useState('');
  const [reportId, setReportId] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [confirming, setConfirming] = useState(false);

  const projection = projectStrike(severity, activeStrikeWeight, activeRestrictions);
  const lines = escalationCopy(projection);
  const canSubmit = reason.trim() !== '';

  const submit = (): void => {
    const payload: IssueStrikePayload = {
      severity,
      reason: reason.trim(),
      ...(reportId.trim() === '' ? {} : { reportId: reportId.trim() }),
      ...(expiresAt === '' ? {} : { expiresAt: new Date(expiresAt).toISOString() }),
    };
    issue.mutate(
      { userId, payload },
      {
        onSuccess: (strike) => {
          toast.success(`Strike issued (weight ${strike.weight}).`);
          setReason('');
          setReportId('');
          setExpiresAt('');
          setConfirming(false);
        },
        onError: (error) => {
          toast.error(getErrorMessage(error));
          setConfirming(false);
        },
      },
    );
  };

  return (
    <QCard as="section" padding="md" className="flex flex-col gap-4">
      <QSectionHeader
        title="Issue a strike"
        description="Lowers the reputation score and can apply a restriction automatically."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="strike-severity" className="text-sm font-medium text-ink">
            Severity
          </label>
          <select
            id="strike-severity"
            value={severity}
            onChange={(event) => {
              setSeverity(event.target.value as StrikeSeverity);
            }}
            className="h-9 rounded-md border border-line bg-surface px-2 text-sm text-ink"
          >
            {SEVERITIES.map((value) => (
              <option key={value} value={value}>
                {strikeSeverityLabel(value)}
              </option>
            ))}
          </select>
          <span className="text-xs text-ink-muted">
            Severity is only a weight: it adds {projection.weight} to their active strike weight of{' '}
            {activeStrikeWeight}.
          </span>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="strike-expires" className="text-sm font-medium text-ink">
            Expires at <span className="text-ink-muted">(optional)</span>
          </label>
          <input
            id="strike-expires"
            type="date"
            value={expiresAt}
            onChange={(event) => {
              setExpiresAt(event.target.value);
            }}
            className="h-9 rounded-md border border-line bg-surface px-2 text-sm text-ink"
          />
          <span className="text-xs text-ink-muted">
            Leave empty for a strike that never expires. An expiry is the only way its weight is
            ever released — nothing revokes a strike.
          </span>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="strike-report" className="text-sm font-medium text-ink">
            Report ID <span className="text-ink-muted">(optional)</span>
          </label>
          <input
            id="strike-report"
            type="text"
            value={reportId}
            placeholder="UUID of the report that prompted this"
            onChange={(event) => {
              setReportId(event.target.value);
            }}
            className="h-9 rounded-md border border-line bg-surface px-2 text-sm text-ink"
          />
        </div>

        <div className="flex flex-col gap-1 sm:col-span-2">
          <label htmlFor="strike-reason" className="text-sm font-medium text-ink">
            Reason <span className="text-ink-muted">(required, recorded in the audit trail)</span>
          </label>
          <textarea
            id="strike-reason"
            rows={2}
            maxLength={1000}
            value={reason}
            onChange={(event) => {
              setReason(event.target.value);
            }}
            className="rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink"
          />
        </div>
      </div>

      <div>
        <QButton
          variant="danger"
          disabled={!canSubmit}
          loading={issue.isPending && !confirming}
          onClick={() => {
            setConfirming(true);
          }}
        >
          Issue strike
        </QButton>
      </div>

      <ConfirmationDialog
        open={confirming}
        danger
        title={
          projection.outcome === 'suspend' && !projection.alreadyEscalated
            ? 'This strike will also suspend the account'
            : projection.outcome === 'restrict' && !projection.alreadyEscalated
              ? 'This strike will also restrict the account'
              : 'Issue this strike?'
        }
        confirmLabel="Issue strike"
        loading={issue.isPending}
        message={
          <span className="flex flex-col gap-2">
            {lines.map((line) => (
              <span key={line}>{line}</span>
            ))}
          </span>
        }
        onConfirm={submit}
        onCancel={() => {
          setConfirming(false);
        }}
      />
    </QCard>
  );
}
