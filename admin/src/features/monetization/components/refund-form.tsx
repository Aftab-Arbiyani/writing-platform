import { QButton, QCard, QSectionHeader, useToast } from '@qalam/ui';
import { AlertTriangle } from 'lucide-react';
import { useState, type ReactElement } from 'react';

import { ConfirmationDialog } from '@/components/confirmation-dialog';
import { isApiError } from '@/lib/errors';

import { PaymentPicker } from './payment-picker';
import { useRefundPayment } from '../hooks/use-monetization';
import { refundOutcome, type RefundOutcome } from '../lib/refund-outcome';

/**
 * Refund a payment (A1b, given a picker by B8).
 *
 * **The operator picks the payment from the account's own history.** A1 shipped a bare ID field
 * because nothing admin-facing listed payments (A1-5); `GET users/:userId/payments` closes that, so
 * the flow is now the one a support ticket actually implies — find the person, see their charges,
 * refund the right one. The ID field survives as an override for a charge older than the page shown,
 * and it stays in sync with the picker in both directions.
 *
 * **Failure is still the interesting half.** Four codes come back and they lead to four different
 * next actions, so they are never collapsed into "refund failed, try again": the retry button is
 * bound to `outcome.retryable`, which means the affordance and the copy can never disagree about
 * whether retrying is worth doing. See `lib/refund-outcome.ts` — including why the not-found copy no
 * longer hedges about payments that were never captured.
 */
export function RefundForm(): ReactElement {
  const toast = useToast();
  const refund = useRefundPayment();
  const [userId, setUserId] = useState('');
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
        userId: userId.trim(),
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
          // Rendered in place, not as a toast: three of the four failures need the operator to read a
          // sentence and change something, and a toast that vanishes is the wrong channel for that.
          setFailure(refundOutcome(isApiError(error) ? error.code : undefined));
          setConfirming(false);
        },
      },
    );
  };

  return (
    // See `credit-adjust-form.tsx` — the two cards share field labels, so each carries a scoping
    // hook for the browser suite (docs/e2e/05 §3).
    <QCard padding="md" className="flex flex-col gap-4" data-testid="refund-form">
      <QSectionHeader
        title="Refund a payment"
        description="Sends a refund to the payment's original provider. Look the account up to pick the charge."
      />

      <div className="flex flex-col gap-1">
        <label htmlFor="refund-user" className="text-sm font-medium text-ink">
          User ID
        </label>
        <input
          id="refund-user"
          type="text"
          value={userId}
          aria-describedby="refund-user-hint"
          onChange={(event) => {
            setUserId(event.target.value);
            setFailure(null);
          }}
          className="h-9 w-full max-w-md rounded-md border border-line bg-surface px-3 text-sm text-ink"
        />
        <span id="refund-user-hint" className="text-xs text-ink-muted">
          Lists this account&rsquo;s recent payments so you can pick the one to refund.
        </span>
      </div>

      {userId.trim() === '' ? null : (
        <section className="flex flex-col gap-2 border-t border-line pt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-secondary">
            Recent payments
          </h3>
          <PaymentPicker
            userId={userId.trim()}
            selectedId={paymentId.trim()}
            onSelect={(id) => {
              setPaymentId(id);
              setFailure(null);
            }}
          />
        </section>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1 sm:col-span-2">
          <label htmlFor="refund-payment" className="text-sm font-medium text-ink">
            Payment ID
          </label>
          <input
            id="refund-payment"
            type="text"
            value={paymentId}
            aria-describedby="refund-payment-hint"
            onChange={(event) => {
              setPaymentId(event.target.value);
              setFailure(null);
            }}
            className="h-9 w-full max-w-md rounded-md border border-line bg-surface px-3 text-sm text-ink"
          />
          <span id="refund-payment-hint" className="text-xs text-ink-muted">
            Filled in when you select a payment above. Paste one directly for a charge older than
            that list.
          </span>
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
