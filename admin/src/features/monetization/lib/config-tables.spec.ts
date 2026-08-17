import { describe, expect, it } from 'vitest';

import { TABLE_SPECS, parseTableValue, tableChanges } from './config-tables';
import { formatMinorUnits } from './money-format';

const TAX = TABLE_SPECS[0];
const RATES = TABLE_SPECS[1];
const REGION = TABLE_SPECS[2];

/**
 * The rules behind the config tables B8 made writable (A1-2), and the money formatter the revenue
 * dashboard needed once figures had a currency (A1-6). Both are pure, and both encode a decision
 * that the obvious implementation gets wrong.
 */
describe('parseTableValue — the form refuses what the DTO would refuse', () => {
  it('reads a tax rate as a fraction and rejects a percentage', () => {
    // `TaxService` computes `amount * rate`, so 20 is 2000% tax. Mirrors `IsRateTable`.
    expect(parseTableValue(TAX, '0.2')).toBe(0.2);
    expect(parseTableValue(TAX, '20')).toBeNull();
    expect(parseTableValue(TAX, '-0.1')).toBeNull();
  });

  it('rejects a currency rate of zero, which would price every plan at nothing', () => {
    expect(parseTableValue(RATES, '0.79')).toBe(0.79);
    expect(parseTableValue(RATES, '0')).toBeNull();
    expect(parseTableValue(RATES, 'zero')).toBeNull();
  });

  it('takes a currency code as text and trims it', () => {
    expect(parseTableValue(REGION, ' gbp ')).toBe('gbp');
    expect(parseTableValue(REGION, '')).toBeNull();
  });
});

describe('tableChanges — a patch says only what changed', () => {
  const current = { default: 0, GB: 0.2 };

  it('sends only edited keys, so the audit entry is readable', () => {
    const result = tableChanges(TAX, current, [
      { key: 'default', value: '0' },
      { key: 'GB', value: '0.25' },
    ]);

    expect(result.patch).toEqual({ GB: 0.25 });
    expect(result.changed).toEqual([{ key: 'GB', from: '0.2', to: '0.25' }]);
  });

  it('marks an added key as new rather than as an edit of nothing', () => {
    const result = tableChanges(TAX, current, [
      { key: 'default', value: '0' },
      { key: 'GB', value: '0.2' },
      { key: 'DE', value: '0.19' },
    ]);

    expect(result.patch).toEqual({ DE: 0.19 });
    expect(result.changed).toEqual([{ key: 'DE', from: '(new)', to: '0.19' }]);
  });

  it('leaves a blanked EXISTING row alone instead of pretending to delete it', () => {
    // `updateConfig` spreads the patch over the stored table, so a key can be added or overwritten
    // and never removed. Treating a blank as a deletion would promise something the endpoint cannot
    // do; the form states the merge rule above the tables rather than enforcing it silently.
    const result = tableChanges(TAX, current, [
      { key: 'default', value: '0' },
      { key: 'GB', value: '' },
    ]);

    expect(result.patch).toEqual({});
    expect(result.changed).toEqual([]);
    expect(result.invalid).toEqual([]);
  });

  it('flags a blank on a row the operator just added', () => {
    const result = tableChanges(TAX, current, [{ key: 'DE', value: '' }]);

    expect(result.invalid).toEqual(['DE']);
    expect(result.patch).toEqual({});
  });

  it('flags a value the server would reject, before the round trip', () => {
    const result = tableChanges(TAX, current, [{ key: 'GB', value: '20' }]);

    expect(result.invalid).toEqual(['GB']);
    expect(result.patch).toEqual({});
  });
});

describe('formatMinorUnits — the exponent is not always 2', () => {
  it('divides by 100 for a two-decimal currency', () => {
    expect(formatMinorUnits(1_250_000, 'usd')).toMatch(/12,500\.00/);
  });

  it('does NOT divide for a currency with no minor unit', () => {
    // The M5-3 defect in one assertion: hard-coding `/100` prints ¥40 for a ¥4,000 charge.
    expect(formatMinorUnits(4_000, 'jpy')).toMatch(/4,000(?!\.)/);
  });

  it('divides by 1000 for a three-decimal currency', () => {
    expect(formatMinorUnits(4_000, 'kwd')).toMatch(/4\.000/);
  });

  it('renders a well-formed but unrecognised code at Intl’s default exponent', () => {
    // Not a fallback: `Intl` accepts any three-letter code and applies an exponent of 2. It knows
    // the real ISO exponents, so this can only be reached by a currency that does not exist.
    expect(formatMinorUnits(1_234, 'zzz')).toMatch(/ZZZ\s*12\.34/);
  });

  it('falls back to the honest pre-B8 rendering for a MALFORMED code', () => {
    // Never throws inside a dashboard, and never guesses a symbol for something that is not one.
    expect(formatMinorUnits(1_234, 'not a currency')).toBe('1,234 NOT A CURRENCY (minor units)');
  });
});
