import { ERROR_CODES } from '@qalam/shared';
import { QCard } from '@qalam/ui';
import { CreditCard } from 'lucide-react';
import type { ReactElement } from 'react';

import { ApiError } from '@/lib/api-client';

export interface PaymentsUnavailableProps {
  /** The refusal the server gave, so the copy can name the actual reason. */
  error: unknown;
}

/**
 * The honest "payments aren't available here" state (AF5, W4).
 *
 * **This exists instead of a fake checkout, and in this deployment it is the state that actually
 * ships.** Two server refusals lead here, verified live against the running stack:
 *
 * - `MONETIZATION_DISABLED` (503) — the pre-seeded `feature.payments.enabled` flag is down, which is
 *   the default for every environment until an admin raises it.
 * - `PAYMENT_PROVIDER_NOT_CONFIGURED` (503) — the flag is up, but the provider has no credentials.
 *   Every adapter is key-gated (`StripeAdapter.isConfigured()` and its Apple/Google siblings all test
 *   a secret for emptiness), and there is **no inert or manual adapter to fall back to**:
 *   `PaymentProvider.Manual` is in the vocabulary with no implementation, so it refuses too. Without
 *   third-party keys, no provider can complete a checkout — the port does not no-op, it declines
 *   (docs/48 §3.6, W4-4).
 *
 * So the plan comparison renders real prices from the real catalogue and, on this stack, cannot
 * complete a purchase. Saying that plainly is the only truthful option: a mocked checkout would fake
 * success at the app boundary, which the E2E invariants forbid and which would be a lie to a reader
 * regardless of what tests want.
 */
export function PaymentsUnavailable({ error }: PaymentsUnavailableProps): ReactElement {
  const notConfigured =
    error instanceof ApiError && error.code === ERROR_CODES.PAYMENT_PROVIDER_NOT_CONFIGURED;

  return (
    <QCard as="section" aria-labelledby="payments-unavailable-heading">
      <div className="flex items-start gap-3">
        <CreditCard className="text-ink-muted mt-0.5 shrink-0" size={20} aria-hidden />
        <div className="flex flex-col gap-1">
          <h3 id="payments-unavailable-heading" className="text-ink text-base font-semibold">
            Payments aren’t available yet
          </h3>
          <p className="text-ink-secondary text-sm">
            {notConfigured
              ? 'This instance has no payment provider set up, so a plan can’t be purchased here yet. Nothing was charged.'
              : 'Plans and payments are still being switched on. Nothing was charged.'}
          </p>
        </div>
      </div>
    </QCard>
  );
}
