import { describe, expect, it } from 'vitest';

import {
  formatCreditDelta,
  formatMoney,
  formatTokens,
  formatUsd,
  formatUsedPercent,
} from './monetization-format';

/**
 * Money formatting is where a monetization client is most quietly wrong, so these tests target the
 * cases that produce a plausible-looking number rather than an obvious break.
 */
describe('formatMoney', () => {
  it('renders minor units as major currency', () => {
    expect(formatMoney(1499, 'usd')).toBe('$14.99');
    expect(formatMoney(499, 'usd')).toBe('$4.99');
    expect(formatMoney(4990, 'usd')).toBe('$49.90');
  });

  it('accepts the wire casing — currencies arrive lower-cased', () => {
    // Every AF5 payload sends `currency` lower-cased ('usd'); `Intl` needs it upper.
    expect(formatMoney(1000, 'usd')).toBe(formatMoney(1000, 'USD'));
  });

  it('handles zero, which is the free tier’s quoted price', () => {
    expect(formatMoney(0, 'usd')).toBe('$0.00');
  });

  it('uses the right symbol for each supported currency', () => {
    // SUPPORTED_CURRENCIES in @qalam/shared. Mobile hand-maps these five and falls back to a bare
    // code for anything else; Intl knows them all, which is the point of using it.
    expect(formatMoney(1499, 'eur')).toContain('14.99');
    expect(formatMoney(1499, 'gbp')).toBe('£14.99');
    expect(formatMoney(1499, 'inr')).toContain('14.99');
  });

  it('keeps two decimals for PKR, overriding Intl’s zero-decimal convention', () => {
    // CLDR renders PKR with no decimals, so the default formatting of 1499 paisa is "PKR 15" — a
    // rounded figure that does not match the amount charged. The server stores hundredths, so the
    // display has to as well.
    expect(formatMoney(1499, 'pkr')).toContain('14.99');
    expect(formatMoney(499, 'pkr')).toContain('4.99');
  });

  it('does NOT divide zero-decimal currencies by 100', () => {
    // The defect this guards: ¥1499 is ¥1,499, not ¥14.99. Dividing by a blanket 100 would
    // under-report a yen price by two orders of magnitude, and it would look like a plausible price.
    expect(formatMoney(1499, 'jpy')).toBe('¥1,499');
    expect(formatMoney(1499, 'krw')).toContain('1,499');
  });

  it('divides three-decimal currencies by 1000', () => {
    expect(formatMoney(1499, 'kwd')).toContain('1.499');
  });

  it('formats a well-formed but unknown code without throwing', () => {
    // Intl accepts any well-formed 3-letter code and echoes it as the symbol, so an unrecognised
    // currency in the pricing config still renders a correct number.
    expect(formatMoney(1499, 'zzz')).toContain('14.99');
    expect(formatMoney(1499, 'zzz')).toContain('ZZZ');
  });

  it('degrades to a bare code rather than throwing on a MALFORMED currency', () => {
    // These are what Intl actually rejects (RangeError). The pricing config is admin-editable, so a
    // typo there must not take the plans page down.
    expect(formatMoney(1499, 'us')).toBe('US 14.99');
    expect(formatMoney(1499, 'usdd')).toBe('USDD 14.99');
  });
});

describe('formatUsd', () => {
  it('treats its input as MAJOR units, unlike formatMoney', () => {
    // `costUsd` on a usage window / credit transaction / forecast is already dollars. Passing it to
    // formatMoney would divide it again — the mirror image of the minor-unit trap above.
    expect(formatUsd(14.99)).toBe('$14.99');
    expect(formatUsd(0)).toBe('$0.00');
    expect(formatUsd(0.004)).toBe('$0.00');
  });
});

describe('formatTokens', () => {
  it('compacts large counts', () => {
    expect(formatTokens(0)).toBe('0');
    expect(formatTokens(999)).toBe('999');
    expect(formatTokens(1234)).toBe('1.2K');
    expect(formatTokens(20_000)).toBe('20K');
    expect(formatTokens(2_000_000)).toBe('2M');
  });
});

describe('formatCreditDelta', () => {
  it('signs both directions, so sign never depends on colour alone', () => {
    expect(formatCreditDelta(2000)).toBe('+2,000');
    expect(formatCreditDelta(-350)).toBe('−350');
    expect(formatCreditDelta(0)).toBe('+0');
  });
});

describe('formatUsedPercent', () => {
  it('renders a whole percentage', () => {
    expect(formatUsedPercent(0)).toBe('0%');
    expect(formatUsedPercent(0.5)).toBe('50%');
    expect(formatUsedPercent(1)).toBe('100%');
  });

  it('clamps an overshoot', () => {
    // Usage is metered AFTER a generation, so the request that spends the last of an allowance can
    // push `usedFraction` past 1. A 137%-wide progress bar is a rendering bug.
    expect(formatUsedPercent(1.37)).toBe('100%');
    expect(formatUsedPercent(-0.2)).toBe('0%');
  });
});
