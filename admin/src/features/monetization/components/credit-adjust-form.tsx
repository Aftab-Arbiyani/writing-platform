import { QButton, QCard, QSectionHeader, useToast } from '@qalam/ui';
import { useState, type ReactElement } from 'react';

import { ConfirmationDialog } from '@/components/confirmation-dialog';
import { getErrorMessage } from '@/lib/errors';
import { formatDateTime } from '@/lib/format';

import { AsyncSection } from '@/components/async-section';
import { useAdjustCredits, useUserCredits } from '../hooks/use-monetization';
import { adjustmentResult, planAdjustment } from '../lib/credit-adjustment';

/**
 * Adjust a user's credit balance (A1b, given a balance by B8) — grant or deduct, with a reason
 * recorded in the audit trail.
 *
 * **A deduction confirms; a grant does not.** A deduction removes something spendable and cannot be
 * undone from this screen, so it earns the dialog. A grant is additive, reversible by a matching
 * deduction, and confirming it would train the operator to click through dialogs — which is how the
 * one that mattered gets clicked through too.
 *
 * **The confirmation now states the resulting balance, which is what A1's brief asked for and A1
 * could not build.** `GET users/:userId/credits` supplies the starting figure, and the projection
 * mirrors the server's zero clamp rather than ignoring it — see `lib/credit-adjustment.ts`, which
 * also records why the clamp itself was left alone. The response's post-adjustment figure is still
 * reported afterwards: it is authoritative, and it is what confirms the projection was right.
 */
export function CreditAdjustForm(): ReactElement {
  const toast = useToast();
  const adjust = useAdjustCredits();
  const [userId, setUserId] = useState('');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [outcome, setOutcome] = useState<string | null>(null);

  const wallet = useUserCredits(userId.trim());
  /**
   * `null` means "not read yet"; a wallet that has never existed is a real balance of 0, not an
   * unknown one. The plan's copy branches on exactly that difference.
   */
  const balance = wallet.data === undefined ? null : (wallet.data.credits?.balance ?? 0);

  const numeric = Number(amount);
  const valid = userId.trim().length > 0 && Number.isInteger(numeric) && numeric !== 0;
  const plan = planAdjustment(Number.isFinite(numeric) ? numeric : 0, balance);

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
    // `data-testid`: this card and the refund card sit side by side on /billing/actions and share
    // field labels ("User ID", "Amount"), so a page-wide label locator is ambiguous by construction.
    // The hook is the scoping container the browser suite needs (docs/e2e/05 §3).
    <QCard padding="md" className="flex flex-col gap-4" data-testid="credit-adjust-form">
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
            A negative number deducts. A deduction never takes the balance below zero.
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

      {userId.trim() === '' ? null : (
        <section className="flex flex-col gap-2 border-t border-line pt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-secondary">
            Current balance
          </h3>
          <AsyncSection
            isLoading={wallet.isLoading}
            error={wallet.error}
            onRetry={() => void wallet.refetch()}
            loadingRows={1}
          >
            {wallet.data === undefined ? null : wallet.data.credits === null ? (
              // Not an error and not a blank: an account that has never held a credit has a real
              // balance, and it is zero.
              <p className="text-sm text-ink-secondary">
                This account has no wallet yet &mdash; it has never been granted or spent a credit,
                so its balance is <strong>0</strong>. A grant creates the wallet.
              </p>
            ) : (
              <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
                <span className="text-2xl font-semibold text-ink [font-variant-numeric:tabular-nums]">
                  {wallet.data.credits.balance.toLocaleString()}
                </span>
                <span className="text-xs text-ink-muted [font-variant-numeric:tabular-nums]">
                  granted {wallet.data.credits.lifetimeGranted.toLocaleString()} &middot; spent{' '}
                  {wallet.data.credits.lifetimeConsumed.toLocaleString()} &middot; updated{' '}
                  {formatDateTime(wallet.data.credits.updatedAt)}
                </span>
              </div>
            )}
          </AsyncSection>
        </section>
      )}

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
