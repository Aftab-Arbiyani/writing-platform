/**
 * What went wrong when a refund fails, and what the operator should do about it (A1b).
 *
 * `POST payments/:id/refund` has THREE distinct failure modes and they lead to three different next
 * actions. Collapsing any two into "refund failed, try again" is the remedy-conflation defect that
 * D3 and W4 were both held to (docs/48 §3.6) — here it would be worse than misleading, because two of
 * the three make retrying pointless and the third makes it the correct move.
 *
 * - `PAYMENT_NOT_FOUND` (404) — nothing to refund under that id. The operator's INPUT is wrong;
 *   retrying the same id will fail identically forever.
 * - `PAYMENT_PROVIDER_ERROR` (502) — the provider refused or was unreachable. The input is fine and
 *   the money has not moved; retrying may well work.
 * - `PAYMENT_PROVIDER_NOT_CONFIGURED` (503) — the adapter for that payment's provider has no
 *   credentials in this environment. Neither the id nor the provider is at fault and no retry will
 *   help until someone configures it. The prompt for this row named only the first two; this one is
 *   real (`payment-registry.service.ts:26` and each adapter's guard) and needs its own sentence.
 *
 * `retryable` is what the UI binds the retry button to, so the affordance and the copy can never
 * disagree about whether trying again is worth it.
 */
export interface RefundOutcome {
  code: string;
  title: string;
  message: string;
  retryable: boolean;
}

const PAYMENT_NOT_FOUND = 'PAYMENT_NOT_FOUND';
const PAYMENT_PROVIDER_ERROR = 'PAYMENT_PROVIDER_ERROR';
const PAYMENT_PROVIDER_NOT_CONFIGURED = 'PAYMENT_PROVIDER_NOT_CONFIGURED';

export function refundOutcome(code: string | undefined): RefundOutcome {
  switch (code) {
    case PAYMENT_NOT_FOUND:
      return {
        code: PAYMENT_NOT_FOUND,
        title: 'No refundable payment with that ID',
        /**
         * Deliberately says "or is not refundable", because the server conflates two states here:
         * `BillingService.refund` throws PAYMENT_NOT_FOUND both when no row exists AND when the row
         * exists but has no `providerPaymentId` — a payment that was never captured at a provider
         * (billing.service.ts:165). Recorded as A1-1 in docs/48 §3. Saying only "no such payment"
         * would send an operator hunting for an id that is in fact correct.
         */
        message:
          'That payment ID does not exist, or the payment was never captured at a provider and so cannot be refunded. Check the ID before trying again.',
        retryable: false,
      };
    case PAYMENT_PROVIDER_ERROR:
      return {
        code: PAYMENT_PROVIDER_ERROR,
        title: 'The payment provider refused the refund',
        message:
          'The ID was valid and no money has moved. The provider rejected the request or could not be reached — retrying may succeed.',
        retryable: true,
      };
    case PAYMENT_PROVIDER_NOT_CONFIGURED:
      return {
        code: PAYMENT_PROVIDER_NOT_CONFIGURED,
        title: 'That provider is not configured here',
        message:
          'This environment has no credentials for the payment’s provider, so refunds cannot be sent. Retrying will not help — configure the provider first.',
        retryable: false,
      };
    default:
      return {
        code: code ?? 'UNKNOWN',
        title: 'The refund did not go through',
        // No claim about the money either way: an unrecognised failure is exactly the case where
        // guessing would be irresponsible.
        message:
          'The request failed for an unexpected reason. Check the payment’s status before retrying.',
        retryable: true,
      };
  }
}
