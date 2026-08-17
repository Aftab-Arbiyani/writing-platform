import { QButton, QCard, QSectionHeader, useToast } from '@qalam/ui';
import { AlertTriangle } from 'lucide-react';
import { useState, type ReactElement } from 'react';

import { ConfirmationDialog } from '@/components/confirmation-dialog';
import { isApiError } from '@/lib/errors';

import { useRefundPayment } from '../hooks/use-monetization';
import { refundOutcome, type RefundOutcome } from '../lib/refund-outcome';

/**
 * Refund a payment (A1b).
 *
 * **It takes a payment ID typed by hand, and that is a contract limit.** Nothing admin-facing lists
 * payments — `GET /monetization/payments` is `@CurrentUser` self-scoped — so there is no picker to
 * offer and the operator arrives with an id from a support ticket or the database (docs/48 §3, A1-5).
 *
 * **Failure is the interesting half.** Three codes come back and they lead to three different next
 * actions, so they are never collapsed into "refund failed, try again": the retry button is bound to
 * `outcome.retryable`, which means the affordance and the copy can never disagree about whether
 * retrying is worth doing. See `lib/refund-outcome.ts` for the three and why a fourth default exists.
 */
export function RefundForm(): ReactElement {
  const toast = useToast();
  const refund = useRefundPayment();
  const [paymentId, setPaymentId] = useState('');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [failure, setFailure] = useState<RefundOutcome | null>(null);
  const [succeeded, setSucceeded] = useState<string | null>(null);

  const partial = amount.trim() !== '';
  const numericAmount = Number(amount);
  const amountValid = !partial || (Number.isInteger(numericAmount) && numericAmount >= 1);
  const valid = paymentId.trim().length > 0 && amountValid;

  const send = (): void => {
    setFailure(null);
    setSucceeded(null);
    refund.mutate(
      {
        paymentId: paymentId.trim(),
        payload: {
          ...(partial ? { amount: numericAmount } : {}),
          ...(reason.trim() === '' ? {} : { reason: reason.trim() }),
        },
      },
      {
        onSuccess: (payment) => {
          // The refund row's amount is negative; show its magnitude so the operator reads a refund of
          // 2000, not "-2000".
          setSucceeded(
            `Refunded ${Math.abs(payment.amount).toLocaleString()} ${payment.currency.toUpperCase()}.`,
          );
          toast.success('Refund sent to the provider.');
          setConfirming(false);
        },
        onError: (error) => {
          // Rendered in place, not as a toast: two of the three failures need the operator to read a
          // sentence and change something, and a toast that vanishes is the wrong channel for that.
          setFailure(refundOutcome(isApiError(error) ? error.code : undefined));
          setConfirming(false);
        },
      },
    );
  };

  return (
    <QCard padding="md" className="flex flex-col gap-4">
      <QSectionHeader
        title="Refund a payment"
        description="Sends a refund to the payment's original provider. There is no admin payment list — paste the payment ID."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1 sm:col-span-2">
          <label htmlFor="refund-payment" className="text-sm font-medium text-ink">
            Payment ID
          </label>
          <input
            id="refund-payment"
            type="text"
            value={paymentId}
            onChange={(event) => {
              setPaymentId(event.target.value);
              setFailure(null);
            }}
            className="h-9 w-full max-w-md rounded-md border border-line bg-surface px-3 text-sm text-ink"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="refund-amount" className="text-sm font-medium text-ink">
            Amount <span className="text-ink-muted">(optional)</span>
          </label>
          <input
            id="refund-amount"
            type="number"
            min={1}
            value={amount}
            aria-invalid={!amountValid}
            aria-describedby="refund-amount-hint"
            onChange={(event) => {
              setAmount(event.target.value);
            }}
            className="h-9 rounded-md border border-line bg-surface px-3 text-sm text-ink"
          />
          <span id="refund-amount-hint" className="text-xs text-ink-muted">
            Minor currency units. Leave empty to refund the payment in full.
          </span>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="refund-reason" className="text-sm font-medium text-ink">
            Reason <span className="text-ink-muted">(optional)</span>
          </label>
          <input
            id="refund-reason"
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
          variant="danger"
          disabled={!valid}
          loading={refund.isPending && !confirming}
          onClick={() => {
            setConfirming(true);
          }}
        >
          Refund payment
        </QButton>
        {succeeded === null ? null : (
          <span role="status" className="text-sm text-success">
            {succeeded}
          </span>
        )}
      </div>

      {failure === null ? null : (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md border border-line bg-raised px-3 py-2"
        >
          <AlertTriangle
            size={16}
            strokeWidth={1.75}
            className="mt-0.5 flex-shrink-0 text-danger"
            aria-hidden
          />
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-ink">{failure.title}</span>
            <span className="text-sm text-ink-secondary">{failure.message}</span>
            {failure.retryable ? (
              <span>
                <QButton
                  variant="secondary"
                  size="sm"
                  loading={refund.isPending}
                  onClick={() => {
                    setConfirming(true);
                  }}
                >
                  Try again
                </QButton>
              </span>
            ) : null}
          </div>
        </div>
      )}

      <ConfirmationDialog
        open={confirming}
        danger
        title="Send this refund?"
        confirmLabel="Send refund"
        loading={refund.isPending}
        message={
          <span className="flex flex-col gap-1">
            <span>
              {partial
                ? `A partial refund of ${numericAmount.toLocaleString()} (minor units) will be sent.`
                : 'The payment will be refunded IN FULL.'}
            </span>
            <span>
              This reaches the payment provider and cannot be reversed from this screen. The refund
              is recorded as a separate payment row.
            </span>
          </span>
        }
        onConfirm={send}
        onCancel={() => {
          setConfirming(false);
        }}
      />
    </QCard>
  );
}
