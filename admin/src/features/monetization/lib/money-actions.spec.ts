import { describe, expect, it } from 'vitest';

import { couponValueHint } from './coupon-value';
import { refundOutcome } from './refund-outcome';

/**
 * The pure rules behind A1b's money actions. All three exist because the naive version of each is
 * quietly wrong: a refund that reports one failure for three causes, a confirmation that promises a
 * balance the server will clamp, and a "Value" field that means six different things.
 */
describe('refundOutcome — four failures, four remedies (docs/48 §3.6)', () => {
  it('calls a bad ID the operator’s input problem, and does not offer a retry', () => {
    const outcome = refundOutcome('PAYMENT_NOT_FOUND');

    expect(outcome.retryable).toBe(false);
    expect(outcome.message).toMatch(/Pick the payment from the account/i);
  });

  it('no longer hedges about payments that were never captured — that is its own code now', () => {
    // A1 wrote "does not exist, OR was never captured at a provider" because `BillingService.refund`
    // threw PAYMENT_NOT_FOUND for both (billing.service.ts:165, recorded as A1-1). B8 split the
    // codes, so the hedge became the inaccurate option: it would tell an operator holding a verified
    // id to go and check it.
    expect(refundOutcome('PAYMENT_NOT_FOUND').message).not.toMatch(/never captured at a provider/i);
  });

  it('says a PAYMENT_NOT_REFUNDABLE id is CORRECT, and offers no retry', () => {
    const outcome = refundOutcome('PAYMENT_NOT_REFUNDABLE');

    expect(outcome.retryable).toBe(false);
    expect(outcome.message).toMatch(/never captured at a payment provider/i);
    expect(outcome.message).toMatch(/the ID is correct/i);
  });

  it('calls a provider refusal retryable, and says no money moved', () => {
    const outcome = refundOutcome('PAYMENT_PROVIDER_ERROR');

    expect(outcome.retryable).toBe(true);
    expect(outcome.message).toMatch(/no money has moved/i);
    expect(outcome.message).toMatch(/retrying may succeed/i);
  });

  it('calls an unconfigured provider unretryable, and names the actual fix', () => {
    // The third failure the brief did not list. Retrying is useless until someone adds credentials.
    const outcome = refundOutcome('PAYMENT_PROVIDER_NOT_CONFIGURED');

    expect(outcome.retryable).toBe(false);
    expect(outcome.message).toMatch(/configure the provider/i);
  });

  it('keeps all four apart in title, message AND retryability', () => {
    const codes = [
      'PAYMENT_NOT_FOUND',
      'PAYMENT_NOT_REFUNDABLE',
      'PAYMENT_PROVIDER_ERROR',
      'PAYMENT_PROVIDER_NOT_CONFIGURED',
    ];
    const outcomes = codes.map(refundOutcome);

    expect(new Set(outcomes.map((o) => o.title)).size).toBe(4);
    expect(new Set(outcomes.map((o) => o.message)).size).toBe(4);
    // Only the provider-refusal case is worth retrying; conflating that with any of the others
    // either hides a working remedy or offers a useless one.
    expect(outcomes.map((o) => o.retryable)).toEqual([false, false, true, false]);
  });

  it('makes no claim about the money for an unrecognised failure', () => {
    const outcome = refundOutcome('SOMETHING_NEW');

    expect(outcome.message).not.toMatch(/no money has moved/i);
    expect(outcome.message).toMatch(/Check the payment’s status/i);
  });
});

/**
 * D5 deleted the `planAdjustment` block that sat here — the confirmation copy for an operator
 * granting or deducting AI credits, including B8's projection of the resulting balance and the
 * `Math.max(0, …)` clamp it mirrored. B4 removed the wallet, so there is no balance to project and
 * no route to adjust.
 */
describe('couponValueHint — the same integer means six things', () => {
  it('distinguishes a percentage from an amount in minor units', () => {
    expect(couponValueHint('percentage_discount')).toMatch(/20% off/);
    expect(couponValueHint('fixed_discount')).toMatch(/Minor currency units/);
  });

  it('covers the credit and day-based types too', () => {
    expect(couponValueHint('promotional_credits')).toMatch(/bonus credits/i);
    expect(couponValueHint('free_trial')).toMatch(/trial days/i);
    expect(couponValueHint('trial_extension')).toMatch(/trial days/i);
    expect(couponValueHint('free_period')).toMatch(/free days/i);
  });

  it('never says the same thing for a discount and a credit grant', () => {
    expect(couponValueHint('fixed_discount')).not.toBe(couponValueHint('promotional_credits'));
  });
});
