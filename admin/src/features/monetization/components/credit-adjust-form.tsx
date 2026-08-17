import { QButton, QCard, QSectionHeader, useToast } from '@qalam/ui';
import { useState, type ReactElement } from 'react';

import { ConfirmationDialog } from '@/components/confirmation-dialog';
import { getErrorMessage } from '@/lib/errors';

import { useAdjustCredits } from '../hooks/use-monetization';
import { adjustmentResult, planAdjustment } from '../lib/credit-adjustment';

/**
 * Adjust a user's credit balance (A1b) — grant or deduct, with a reason recorded in the audit trail.
 *
 * **A deduction confirms; a grant does not.** A deduction removes something spendable and cannot be
 * undone from this screen, so it earns the dialog. A grant is additive, reversible by a matching
 * deduction, and confirming it would train the operator to click through dialogs — which is how the
 * one that mattered gets clicked through too.
 *
 * **What the confirmation does NOT say is the point.** It states the delta and the zero floor, both
 * certain, and never a projected balance: no admin route reads another user's wallet, and
 * `CreditService.apply` clamps at zero anyway, so any figure computed here could be one the server
 * will not honour. The real balance is reported after the call from the response, which is
 * authoritative and post-clamp. See `lib/credit-adjustment.ts`.
 */
export function CreditAdjustForm(): ReactElement {
  const toast = useToast();
  const adjust = useAdjustCredits();
  const [userId, setUserId] = useState('');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [confirming, setConfirming] = useState(false);
  /** The one balance figure this surface can state honestly — the server's, after the fact. */
  const [outcome, setOutcome] = useState<string | null>(null);

  const numeric = Number(amount);
  const valid = userId.trim().length > 0 && Number.isInteger(numeric) && numeric !== 0;
  const plan = planAdjustment(Number.isFinite(numeric) ? numeric : 0);

  const send = (): void => {
    adjust.mutate(
      {
        userId: userId.trim(),
        amount: numeric,
        ...(reason.trim() === '' ? {} : { reason: reason.trim() }),
      },
      {
        onSuccess: (result) => {
          setOutcome(adjustmentResult(plan.direction, result.balance));
          toast.success('Credit balance adjusted.');
          setAmount('');
          setReason('');
          setConfirming(false);
        },
        onError: (error) => {
          toast.error(getErrorMessage(error));
          setConfirming(false);
        },
      },
    );
  };

  const start = (): void => {
    setOutcome(null);
    if (plan.destructive) {
      setConfirming(true);
      return;
    }
    send();
  };

  return (
    <QCard padding="md" className="flex flex-col gap-4">
      <QSectionHeader
        title="Adjust credits"
        description="Positive grants, negative deducts. Both are written to the audit trail."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="credit-user" className="text-sm font-medium text-ink">
            User ID
          </label>
          <input
            id="credit-user"
            type="text"
            value={userId}
            onChange={(event) => {
              setUserId(event.target.value);
            }}
            className="h-9 rounded-md border border-line bg-surface px-3 text-sm text-ink"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="credit-amount" className="text-sm font-medium text-ink">
            Amount
          </label>
          <input
            id="credit-amount"
            type="number"
            value={amount}
            aria-describedby="credit-amount-hint"
            onChange={(event) => {
              setAmount(event.target.value);
            }}
            className="h-9 rounded-md border border-line bg-surface px-3 text-sm text-ink"
          />
          <span id="credit-amount-hint" className="text-xs text-ink-muted">
            A negative number deducts. This screen cannot show the current balance &mdash; the
            server has no admin route for one.
          </span>
        </div>

        <div className="flex flex-col gap-1 sm:col-span-2">
          <label htmlFor="credit-reason" className="text-sm font-medium text-ink">
            Reason <span className="text-ink-muted">(optional, recorded in the audit trail)</span>
          </label>
          <input
            id="credit-reason"
            type="text"
            maxLength={255}
            value={reason}
            onChange={(event) => {
              setReason(event.target.value);
            }}
            className="h-9 rounded-md border border-line bg-surface px-3 text-sm text-ink"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <QButton
          variant={plan.destructive ? 'danger' : 'primary'}
          disabled={!valid}
          loading={adjust.isPending && !confirming}
          onClick={start}
        >
          {plan.destructive ? 'Deduct credits' : 'Grant credits'}
        </QButton>
        {outcome === null ? null : (
          <span role="status" className="text-sm text-ink-secondary">
            {outcome}
          </span>
        )}
      </div>

      <ConfirmationDialog
        open={confirming}
        danger
        title={plan.title}
        confirmLabel="Deduct"
        loading={adjust.isPending}
        message={plan.consequence}
        onConfirm={send}
        onCancel={() => {
          setConfirming(false);
        }}
      />
    </QCard>
  );
}
