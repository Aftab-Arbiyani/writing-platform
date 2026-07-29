/**
 * Money + amount formatting for the monetization surfaces (AF5, W4).
 *
 * Ported from mobile's `monetization_format.dart`, with one deliberate improvement: mobile hand-maps
 * five currency symbols and falls back to `"PKR 12.34"` for anything else, which silently
 * mis-renders the moment the pricing config adds a sixth currency. The web has `Intl.NumberFormat`,
 * which knows every ISO-4217 code, its symbol, its decimal places, and where the symbol goes — so
 * this uses it and the sixth currency needs no code change.
 *
 * **Amounts on the wire are minor units** (cents) — `1499, 'usd'` is $14.99. That is true of every
 * monetary field in the AF5 contract (plan prices, invoice subtotal/tax/total, payment and purchase
 * amounts, a coupon's discounted amount), so nothing here ever divides twice.
 *
 * Numerals follow the app policy (docs/06 §6.5): the `en` locale, Latin digits, one numeric voice
 * across the UI — the same choice `lib/format.ts` makes for dates and counts.
 */

/**
 * Minor units in one major unit, for the currencies that are not hundredths.
 *
 * Almost every currency is 2 decimal places, but not all: JPY and KRW have none, so ¥1499 is
 * ¥1499 and not ¥14.99, and dividing by 100 would under-report a price by two orders of magnitude.
 * `Intl` knows the decimal count for formatting, but not for the *conversion* — that has to happen
 * before it is handed the number, so the exceptions are listed. Only the zero-decimal cases matter
 * in practice; the three-decimal dinars are here for completeness.
 */
const MINOR_UNITS: Record<string, number> = {
  bif: 1,
  clp: 1,
  djf: 1,
  gnf: 1,
  isk: 1,
  jpy: 1,
  kmf: 1,
  krw: 1,
  pyg: 1,
  rwf: 1,
  ugx: 1,
  vnd: 1,
  vuv: 1,
  xaf: 1,
  xof: 1,
  xpf: 1,
  bhd: 1000,
  iqd: 1000,
  jod: 1000,
  kwd: 1000,
  lyd: 1000,
  omr: 1000,
  tnd: 1000,
};

function minorUnitsPer(currency: string): number {
  return MINOR_UNITS[currency.toLowerCase()] ?? 100;
}

/**
 * A minor-unit amount as money: `(1499, 'usd')` → `"$14.99"`.
 *
 * **The fraction digits are pinned to the currency's actual minor unit, overriding `Intl`'s display
 * convention**, because the two disagree in a way that would misreport a charge. `Intl` follows CLDR,
 * which renders PKR with *zero* decimals by local convention — so `1499` paisa formats as `"PKR 15"`
 * unless told otherwise, and a reader comparing that to their bank statement finds ₨14.99. Deriving
 * the digit count from {@link MINOR_UNITS} instead keeps the displayed figure equal to the amount the
 * server holds, for every currency: two decimals for the hundredths, none for JPY/KRW, three for the
 * dinars.
 *
 * An unformattable code degrades to `"CODE 14.99"` rather than taking a page down over a typo in the
 * admin-editable pricing config. Note that `Intl` only rejects *malformed* codes (`'US'`, `'usdd'`) —
 * a well-formed but unknown code like `'ZZZ'` formats fine as its own symbol, so the fallback is
 * narrower than it looks.
 */
export function formatMoney(minor: number, currency: string): string {
  const per = minorUnitsPer(currency);
  const amount = minor / per;
  // 1 → 0 digits, 100 → 2, 1000 → 3.
  const digits = Math.log10(per);
  const code = currency.toUpperCase();
  try {
    return new Intl.NumberFormat('en', {
      style: 'currency',
      currency: code,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(amount);
  } catch {
    return `${code} ${amount.toFixed(digits)}`;
  }
}

/**
 * A USD figure the backend already sends in *major* units — `costUsd` on a usage window, a credit
 * transaction, and the monthly forecast. Distinct from {@link formatMoney} on purpose: passing a
 * `costUsd` to that would divide an already-major amount by 100.
 */
export function formatUsd(amount: number): string {
  return new Intl.NumberFormat('en', { style: 'currency', currency: 'USD' }).format(amount);
}

const COUNT_FMT = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });

/**
 * A compact credit / token count: `1234` → `"1.2K"`.
 *
 * Same output as `lib/format.ts#formatCount` and deliberately a separate function rather than an
 * import: a token count and a clap count are different quantities that happen to share a
 * presentation today, and a credit balance must not change shape because the feed's counter did.
 */
export function formatTokens(value: number): string {
  return COUNT_FMT.format(value);
}

/** A signed credit delta for the ledger: `+2,000` / `-350`. Grants read as additions. */
export function formatCreditDelta(delta: number): string {
  const magnitude = new Intl.NumberFormat('en').format(Math.abs(delta));
  return `${delta < 0 ? '−' : '+'}${magnitude}`;
}

/**
 * A used fraction as a whole percentage, clamped to 0–100.
 *
 * The server can report a fraction above 1 — usage is metered after a call completes, so the last
 * request of a period can overshoot its own limit — and a 137%-full progress bar is a rendering
 * bug, not information. Clamped so the bar stays a bar; the exhausted state is what matters.
 */
export function formatUsedPercent(fraction: number): string {
  return `${Math.round(Math.min(1, Math.max(0, fraction)) * 100)}%`;
}
