import { describe, expect, it } from 'vitest';

import { couponValueHint } from './coupon-value';
import { adjustmentResult, planAdjustment } from './credit-adjustment';
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

describe('planAdjustment — a deduction confirms, a grant does not', () => {
  it('marks a deduction destructive and titles it as a deduction', () => {
    const plan = planAdjustment(-500, 1200);

    expect(plan.direction).toBe('deduct');
    expect(plan.destructive).toBe(true);
    expect(plan.magnitude).toBe(500);
    expect(plan.title).toBe('Deduct 500 credits?');
  });

  it('projects the resulting balance now that one can be read', () => {
    // A1 could state only the delta and the floor rule, because no admin route read another user's
    // wallet (A1-3). `GET users/:userId/credits` closed that, so the confirmation states the result.
    const plan = planAdjustment(-500, 1200);

    expect(plan.consequence).toMatch(/from 1,200 to 700 credits/i);
    expect(plan.consequence).toMatch(/cannot be undone/i);
  });

  it('says the clamp will bite rather than projecting a negative balance', () => {
    // DECISION 3: `CreditService.apply` computes `Math.max(0, balance + delta)`
    // (credit.service.ts:111) and B8 leaves that alone. So the projection mirrors it — "200 → -300"
    // would be a number the server refuses to honour, and a bare "success" would hide that only 200
    // of the 500 was actually taken.
    const plan = planAdjustment(-500, 200);

    expect(plan.consequence).toMatch(/emptied to 0 rather than going negative/i);
    expect(plan.consequence).toMatch(/only 200 credits are actually removed/i);
    expect(plan.consequence).not.toMatch(/-300/);
  });

  it('falls back to the floor rule when the balance has not been read yet', () => {
    // `null` is "unknown", not "zero": an unread balance must not be projected from, and an empty
    // wallet is a real balance of 0. Both are certain statements; only one is a projection.
    const plan = planAdjustment(-500, null);

    expect(plan.consequence).toMatch(/will not go below zero/i);
    expect(plan.consequence).not.toMatch(/from .* to .* credits/i);
  });

  it('leaves a grant non-destructive so the dialog stays meaningful', () => {
    const plan = planAdjustment(250, 1200);

    expect(plan.direction).toBe('grant');
    expect(plan.destructive).toBe(false);
    expect(plan.consequence).toMatch(/from 1,200 to 1,450 credits/i);
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
