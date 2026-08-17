/**
 * What a coupon's `value` MEANS, which changes with its type (A1b).
 *
 * The same integer is a percentage, an amount in minor units, a number of credits, or a number of
 * days depending on `type` — `PromotionService.describe` switches on exactly this. A form that labels
 * it "Value" and stops there invites a 20-cent discount where 20 percent was intended, so the hint is
 * derived from the same mapping the server uses rather than written once and left to rot.
 */
export function couponValueHint(type: string): string {
  switch (type) {
    case 'percentage_discount':
      return 'A percentage — 20 means 20% off.';
    case 'fixed_discount':
      return 'Minor currency units — 2000 means 20.00 off.';
    case 'promotional_credits':
      return 'A number of bonus credits.';
    case 'free_trial':
    case 'trial_extension':
      return 'A number of extra trial days.';
    case 'free_period':
      return 'A number of free days on the subscription.';
    default:
      return 'A whole number, interpreted by the promotion type.';
  }
}
