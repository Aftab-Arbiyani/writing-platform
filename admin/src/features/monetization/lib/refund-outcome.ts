/**
 * What went wrong when a refund fails, and what the operator should do about it (A1b, extended by B8).
 *
 * `POST payments/:id/refund` has FOUR distinct failure modes and they lead to four different next
 * actions. Collapsing any two into "refund failed, try again" is the remedy-conflation defect that
 * D3 and W4 were both held to (docs/48 §3.6) — here it would be worse than misleading, because three
 * of the four make retrying pointless and the other makes it the correct move.
 *
 * - `PAYMENT_NOT_FOUND` (404) — no payment row under that id. The operator's INPUT is wrong; the
 *   remedy is to find the right id, which the payment picker now hands them directly.
 * - `PAYMENT_NOT_REFUNDABLE` (409) — the row EXISTS and was never captured at a provider, so there
 *   is no charge to reverse. The id is exactly right and no id will ever work.
 * - `PAYMENT_PROVIDER_ERROR` (502) — the provider refused or was unreachable. The input is fine and
 *   the money has not moved; retrying may well work.
 * - `PAYMENT_PROVIDER_NOT_CONFIGURED` (503) — the adapter for that payment's provider has no
 *   credentials in this environment. Neither the id nor the provider is at fault and no retry will
 *   help until someone configures it. The prompt for A1 named only the first and third; this one is
 *   real (`payment-registry.service.ts:26` and each adapter's guard) and needs its own sentence.
 *
 * **The first two used to be one sentence, and A1 was right to write it that way.** The server threw
 * `PAYMENT_NOT_FOUND` for both, so "does not exist, or was never captured at a provider" was the only
 * claim the copy could make without asserting something it could not know. B8 split the codes
 * (docs/48 §3, A1-1), so the hedge is now the inaccurate option: it would tell an operator holding a
 * verified id to go and check it.
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
const PAYMENT_NOT_REFUNDABLE = 'PAYMENT_NOT_REFUNDABLE';
const PAYMENT_PROVIDER_ERROR = 'PAYMENT_PROVIDER_ERROR';
const PAYMENT_PROVIDER_NOT_CONFIGURED = 'PAYMENT_PROVIDER_NOT_CONFIGURED';

export function refundOutcome(code: string | undefined): RefundOutcome {
  switch (code) {
    case PAYMENT_NOT_FOUND:
      return {
        code: PAYMENT_NOT_FOUND,
        title: 'No payment with that ID',
        // Now says only what it means. The server answers PAYMENT_NOT_REFUNDABLE for the other
        // state, so an id that reaches here really is wrong.
        message:
          'No payment exists under that ID. Pick the payment from the account’s list above rather than typing an ID, if you have not already.',
        retryable: false,
      };
    case PAYMENT_NOT_REFUNDABLE:
      return {
        code: PAYMENT_NOT_REFUNDABLE,
        title: 'That payment cannot be refunded',
        message:
          'The payment exists and the ID is correct, but it was never captured at a payment provider — there is no charge to reverse. Adjust the account’s credits instead if the customer is owed something.',
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
