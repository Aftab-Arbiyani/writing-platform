/**
 * What a credit adjustment will do, now that the surface can read the balance it acts on (A1b,
 * completed by B8).
 *
 * **The projection is real, and it accounts for the clamp rather than ignoring it.** A1 could state
 * only the delta and the zero floor, because no admin route read another user's wallet — any "X → Y"
 * it printed would have been arithmetic over an unknown X. `GET users/:userId/credits` closes that,
 * so the confirmation states the balance, the delta, and the result.
 *
 * **DECISION 3 — the zero clamp stays, unchanged.** `CreditService.apply` computes
 * `Math.max(0, balance + delta)` (credit.service.ts:111), so deducting 500 from a balance of 200
 * succeeds, lands on 0, and never raises `INSUFFICIENT_CREDITS`. B8 deliberately does not touch it:
 * over-spend is prevented upstream by the usage meter's quota check, the clamp keeps the wallet and
 * the append-only ledger consistent (the ledger records the CLAMPED delta, not the requested one),
 * and turning a currently-succeeding admin deduction into a 402 is a behaviour change no row has
 * asked for. What changes is that the operator is no longer left to guess: when a deduction would go
 * below zero the confirmation says so in the same breath as the result, so nobody reads "-300" back
 * to a customer and nobody is surprised by a "success" that removed less than they typed.
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

/**
 * The balance after the server applies this adjustment — the same `Math.max(0, …)` the service
 * computes, mirrored rather than approximated, so the figure shown is the figure that lands.
 */
export function projectedBalance(balance: number, amount: number): number {
  return Math.max(0, balance + amount);
}

/**
 * True when a deduction asks for more than the account holds, so the clamp will absorb the
 * difference and the adjustment will remove less than the operator typed.
 */
export function clampWillBite(balance: number, amount: number): boolean {
  return amount < 0 && balance + amount < 0;
}

/**
 * @param amount signed — positive grants, negative deducts.
 * @param balance the account's current balance, or `null` when it has not been read yet (an empty
 *   wallet reads as 0, which is a balance; `null` means unknown, and the copy falls back to the
 *   delta-and-floor wording rather than projecting from a number it does not have).
 */
export function planAdjustment(amount: number, balance: number | null): AdjustmentPlan {
  const deduct = amount < 0;
  const magnitude = Math.abs(amount);
  const formatted = magnitude.toLocaleString();

  if (!deduct) {
    return {
      direction: 'grant',
      magnitude,
      destructive: false,
      title: `Grant ${formatted} credits?`,
      consequence:
        balance === null
          ? `${formatted} credits will be added to this account and are immediately spendable.`
          : `The balance goes from ${balance.toLocaleString()} to ${projectedBalance(balance, amount).toLocaleString()} credits, immediately spendable.`,
    };
  }

  const base = `${formatted} credits will be removed from this account. Credits are spent on AI generations, and this cannot be undone.`;

  if (balance === null) {
    return {
      direction: 'deduct',
      magnitude,
      destructive: true,
      title: `Deduct ${formatted} credits?`,
      consequence: `${base} The balance will not go below zero — if the account holds fewer than ${formatted}, it will be emptied rather than going negative.`,
    };
  }

  const next = projectedBalance(balance, amount);
  let consequence: string;
  if (balance === 0) {
    // Its own sentence because the general clamp wording degenerates here into "only 0 credits are
    // actually removed", which reads like a bug report. An empty wallet is a common state on this
    // screen — most accounts have never been granted a credit.
    consequence = `This account holds no credits, so the deduction removes nothing and the balance stays at 0. It is still recorded in the audit trail.`;
  } else if (clampWillBite(balance, amount)) {
    consequence = `The account holds ${balance.toLocaleString()} credits, which is fewer than the ${formatted} you asked to deduct. It will be emptied to 0 rather than going negative, so only ${balance.toLocaleString()} credits are actually removed. This cannot be undone.`;
  } else {
    consequence = `The balance goes from ${balance.toLocaleString()} to ${next.toLocaleString()} credits. ${base.slice(base.indexOf('Credits are spent'))}`;
  }

  return {
    direction: 'deduct',
    magnitude,
    destructive: true,
    title: `Deduct ${formatted} credits?`,
    consequence,
  };
}

/** The server's own post-clamp figure, reported after the fact — still the authoritative one. */
export function adjustmentResult(direction: AdjustmentDirection, balance: number): string {
  const verb = direction === 'deduct' ? 'Deducted' : 'Granted';
  return `${verb}. The account's balance is now ${balance.toLocaleString()} credits.`;
}
