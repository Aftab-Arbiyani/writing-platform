/**
 * Render a minor-unit amount in its own currency (B8).
 *
 * Every money figure on this surface is stored in minor units, and until B8 the revenue dashboard
 * could not print a currency at all: `sumPayments` added every currency together, so a symbol would
 * have asserted something false (A1-6). `byCurrency` gives each figure one unit, so it can finally
 * be shown as money.
 *
 * **The exponent is not always 2, and hard-coding `/100` is the M5-3 defect** (docs/48 §3, mobile's
 * `formatMoney` mis-rendered every currency but five). JPY has no minor unit and KWD has three, so
 * ¥1000 stored as `1000` is ¥1,000 while $1000 stored as `1000` is $10.00. `Intl` knows each
 * currency's exponent; ask it rather than assuming.
 *
 * A MALFORMED code (anything `Intl` refuses to construct a formatter for) falls back to the honest
 * pre-B8 rendering — the number, the code, and the word "minor units" — rather than throwing inside
 * a dashboard. A well-formed code `Intl` does not recognise is not a fallback case: `Intl` accepts
 * any three-letter code and renders it with its default exponent of 2. That is the right answer for
 * a currency the runtime has not heard of, and it is not silently wrong for any real one, because
 * `Intl` knows the ISO 4217 exponents.
 */
export function formatMinorUnits(minor: number, currency: string): string {
  const code = currency.trim().toUpperCase();
  try {
    const formatter = new Intl.NumberFormat(undefined, { style: 'currency', currency: code });
    const exponent = formatter.resolvedOptions().maximumFractionDigits ?? 2;
    return formatter.format(minor / 10 ** exponent);
  } catch {
    return `${minor.toLocaleString()} ${code} (minor units)`;
  }
}
