import { describe, expect, it } from 'vitest';

import { couponValueHint } from './coupon-value';
import { adjustmentResult, planAdjustment } from './credit-adjustment';
import { refundOutcome } from './refund-outcome';

/**
 * The pure rules behind A1b's money actions. All three exist because the naive version of each is
 * quietly wrong: a refund that reports one failure for three causes, a confirmation that promises a
 * balance the server will clamp, and a "Value" field that means six different things.
 */
describe('refundOutcome — three failures, three remedies (docs/48 §3.6)', () => {
  it('calls a bad ID the operator’s input problem, and does not offer a retry', () => {
    const outcome = refundOutcome('PAYMENT_NOT_FOUND');

    expect(outcome.retryable).toBe(false);
    expect(outcome.message).toMatch(/Check the ID/i);
  });

  it('says a not-found payment might exist but be unrefundable — the server conflates both', () => {
    // `BillingService.refund` throws PAYMENT_NOT_FOUND when the row is missing AND when it exists
    // with no `providerPaymentId` (billing.service.ts:165). Saying only "no such payment" would send
    // the operator hunting for an id that is in fact correct. Recorded as A1-1.
    expect(refundOutcome('PAYMENT_NOT_FOUND').message).toMatch(/never captured at a provider/i);
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

  it('keeps all three apart in title, message AND retryability', () => {
    const codes = [
      'PAYMENT_NOT_FOUND',
      'PAYMENT_PROVIDER_ERROR',
      'PAYMENT_PROVIDER_NOT_CONFIGURED',
    ];
    const outcomes = codes.map(refundOutcome);

    expect(new Set(outcomes.map((o) => o.title)).size).toBe(3);
    expect(new Set(outcomes.map((o) => o.message)).size).toBe(3);
    // Only the provider-refusal case is worth retrying; conflating that with either of the others
    // either hides a working remedy or offers a useless one.
    expect(outcomes.map((o) => o.retryable)).toEqual([false, true, false]);
  });

  it('makes no claim about the money for an unrecognised failure', () => {
    const outcome = refundOutcome('SOMETHING_NEW');

    expect(outcome.message).not.toMatch(/no money has moved/i);
    expect(outcome.message).toMatch(/Check the payment’s status/i);
  });
});

describe('planAdjustment — a deduction confirms, a grant does not', () => {
  it('marks a deduction destructive and titles it as a deduction', () => {
    const plan = planAdjustment(-500);

    expect(plan.direction).toBe('deduct');
    expect(plan.destructive).toBe(true);
    expect(plan.magnitude).toBe(500);
    expect(plan.title).toBe('Deduct 500 credits?');
  });

  it('states the zero floor instead of a projected balance', () => {
    // The projection cannot be built: no admin route reads another user's wallet, and
    // `CreditService.apply` clamps at zero anyway (credit.service.ts:111). Promising "200 → -300"
    // would be a number the server refuses to honour.
    const plan = planAdjustment(-500);

    expect(plan.consequence).toMatch(/will not go below zero/i);
    expect(plan.consequence).toMatch(/emptied rather than going negative/i);
    expect(plan.consequence).toMatch(/cannot be undone/i);
  });

  it('leaves a grant non-destructive so the dialog stays meaningful', () => {
    const plan = planAdjustment(250);

    expect(plan.direction).toBe('grant');
    expect(plan.destructive).toBe(false);
    expect(plan.consequence).toMatch(/immediately spendable/i);
  });

  it('reports only the server’s post-clamp balance afterwards', () => {
    expect(adjustmentResult('deduct', 0)).toBe("Deducted. The account's balance is now 0 credits.");
    expect(adjustmentResult('grant', 1500)).toMatch(/now 1,500 credits/);
  });
});

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
