import { QButton, QTag } from '@qalam/ui';
import type { ReactElement } from 'react';

import { EmptyState } from '@/components/empty-state';
import { formatDateTime } from '@/lib/format';

import { AsyncSection } from '@/components/async-section';
import { useUserPayments } from '../hooks/use-monetization';
import { formatMinorUnits } from '../lib/money-format';

/**
 * Pick the payment to refund from the account's own history (B8, closing A1-5).
 *
 * A1's refund form was an ID-entry field because nothing admin-facing listed payments; the operator
 * arrived holding an id from a support ticket or the database. `GET users/:userId/payments` exists
 * now, so the id comes from the same screen as the action.
 *
 * **Refund rows are shown, not filtered out, and are not selectable.** A refund is stored as its own
 * negative payment row on the same account, so hiding them would make an already-refunded charge
 * look untouched — which is exactly the mistake this picker should prevent. They are listed, marked,
 * and cannot be chosen: refunding a refund is not a thing the server can do.
 */
export interface PaymentPickerProps {
  userId: string;
  selectedId: string;
  onSelect: (paymentId: string) => void;
}

export function PaymentPicker({ userId, selectedId, onSelect }: PaymentPickerProps): ReactElement {
  const payments = useUserPayments(userId);
  const page = payments.data;

  return (
    <AsyncSection
      isLoading={payments.isLoading}
      error={payments.error}
      onRetry={() => void payments.refetch()}
      loadingRows={3}
    >
      {page === undefined ? null : page.items.length === 0 ? (
        <EmptyState
          title="No payments on this account"
          description="Nothing has ever been charged here, so there is nothing to refund."
          minHeight={160}
        />
      ) : (
        <div className="flex flex-col gap-2">
          <ul className="flex flex-col divide-y divide-line">
            {page.items.map((payment) => {
              const isRefund = payment.amount < 0;
              const selected = payment.id === selectedId;
              return (
                <li
                  key={payment.id}
                  className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-2"
                >
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-ink [font-variant-numeric:tabular-nums]">
                        {formatMinorUnits(Math.abs(payment.amount), payment.currency)}
                      </span>
                      <QTag
                        color={
                          isRefund
                            ? 'warning'
                            : payment.status === 'succeeded'
                              ? 'success'
                              : 'neutral'
                        }
                      >
                        {isRefund ? 'refund' : payment.status}
                      </QTag>
                      <QTag color="info">{payment.provider}</QTag>
                    </span>
                    <span className="text-xs text-ink-muted">
                      {formatDateTime(payment.createdAt)}
                      {payment.description === null ? '' : ` · ${payment.description}`}
                    </span>
                    <code className="truncate font-mono text-xs text-ink-secondary">
                      {payment.id}
                    </code>
                  </div>
                  {isRefund ? (
                    <span className="text-xs text-ink-muted">Already a refund</span>
                  ) : (
                    <QButton
                      variant={selected ? 'primary' : 'secondary'}
                      size="sm"
                      onClick={() => {
                        onSelect(payment.id);
                      }}
                    >
                      {selected ? 'Selected' : 'Select'}
                    </QButton>
                  )}
                </li>
              );
            })}
          </ul>
          {page.hasMore ? (
            // Said plainly rather than left to be inferred from a list that happens to stop: an
            // operator hunting an older charge needs to know they are not looking at everything.
            <p className="text-xs text-ink-muted">
              Showing the {page.items.length} most recent payments. Older ones are not listed here
              &mdash; paste the ID below if the charge you need is further back.
            </p>
          ) : null}
        </div>
      )}
    </AsyncSection>
  );
}
