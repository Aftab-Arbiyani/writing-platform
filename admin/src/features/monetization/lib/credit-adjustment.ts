/**
 * What a credit adjustment will do, stated only as far as the contract allows (A1b).
 *
 * **Why there is no projected balance here.** The obvious confirmation — "balance will go from X to
 * Y" — cannot be built over this surface, for two independent reasons found in the audit:
 *
 * 1. **No admin route reads another user's wallet.** `GET /monetization/credits` is `@CurrentUser`
 *    self-scoped, so an admin asking it would get their OWN balance. The pre-adjustment figure is
 *    simply unavailable (docs/48 §3, A1-3).
 * 2. **A deduction clamps instead of failing.** `CreditService.apply` computes
 *    `Math.max(0, balance + delta)` (credit.service.ts:111), so deducting 500 from a balance of 200
 *    succeeds, lands on 0, and never raises `INSUFFICIENT_CREDITS`. Even with the starting figure,
 *    plain arithmetic would print a number the server will not honour.
 *
 * So the confirmation states the DELTA and the floor rule, both of which are certain, and the actual
 * resulting balance is reported afterwards from the response — which is authoritative and post-clamp.
 * An invented projection would be the kind of number an operator reads back to a customer.
 */
export type AdjustmentDirection = 'grant' | 'deduct';

export interface AdjustmentPlan {
  direction: AdjustmentDirection;
  /** Always positive — the direction carries the sign. */
  magnitude: number;
  /** True when this action can reduce a real balance and therefore needs a confirmation. */
  destructive: boolean;
  title: string;
  /** What will happen, in terms this surface can actually guarantee. */
  consequence: string;
}

export function planAdjustment(amount: number): AdjustmentPlan {
  const deduct = amount < 0;
  const magnitude = Math.abs(amount);
  const formatted = magnitude.toLocaleString();

  if (deduct) {
    return {
      direction: 'deduct',
      magnitude,
      destructive: true,
      title: `Deduct ${formatted} credits?`,
      consequence:
        `${formatted} credits will be removed from this account. Credits are spent on AI generations, ` +
        'and this cannot be undone. The balance will not go below zero — if the account holds fewer ' +
        `than ${formatted}, it will be emptied rather than going negative.`,
    };
  }
  return {
    direction: 'grant',
    magnitude,
    destructive: false,
    title: `Grant ${formatted} credits?`,
    consequence: `${formatted} credits will be added to this account and are immediately spendable.`,
  };
}

/** The one balance figure this surface can state honestly: the server's own, after the fact. */
export function adjustmentResult(direction: AdjustmentDirection, balance: number): string {
  const verb = direction === 'deduct' ? 'Deducted' : 'Granted';
  return `${verb}. The account's balance is now ${balance.toLocaleString()} credits.`;
}
