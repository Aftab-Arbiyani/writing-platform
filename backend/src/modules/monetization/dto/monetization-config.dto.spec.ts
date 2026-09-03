import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

import { UpdateMonetizationConfigDto } from './monetization-request.dto';

/**
 * The three config tables `PATCH /admin/monetization/config` could not write (docs/48 §3, A1-2).
 *
 * **This is the test that would have caught it.** The service layer was never the problem:
 * `MonetizationConfigPatch` carried all seven fields and `updateConfig` merged each table per key,
 * and the config-service spec proved as much. The gap was one layer out — the DTO declared four
 * properties, so the boundary threw the other three away before any of that ran, and no spec ever
 * pushed a payload through the boundary.
 *
 * So these assert against a DTO instance built the way `main.ts` builds one (`whitelist: true`,
 * `forbidNonWhitelisted: true`, `transform: true`, implicit conversion OFF). A field that survives
 * here is a field the service will actually see.
 *
 * **One correction to A1's diagnosis, which the code settles.** A1-2 says the three fields were
 * "stripped". With `forbidNonWhitelisted: true` also set (`main.ts:170`), an undeclared property is
 * REJECTED, not dropped — the request 400s with `VALIDATION_FAILED`. Louder than recorded, and
 * unwritable either way.
 */

/** Mirrors the global pipe's transform, so `whitelisted` below means what the boundary means. */
function received(payload: Record<string, unknown>): UpdateMonetizationConfigDto {
  return plainToInstance(UpdateMonetizationConfigDto, payload, {
    enableImplicitConversion: false,
  });
}

function errorsOn(payload: Record<string, unknown>): string[] {
  return validateSync(received(payload), {
    whitelist: true,
    forbidNonWhitelisted: true,
  }).map((error) => error.property);
}

describe('UpdateMonetizationConfigDto — the three tables are writable (A1-2)', () => {
  const patch = {
    trialDays: 14,
    gracePeriodDays: 3,
    taxRates: { default: 0, GB: 0.2, PK: 0.17 },
    currencyRates: { usd: 1, gbp: 0.79, pkr: 278 },
    regionCurrency: { GB: 'gbp', PK: 'pkr' },
  };

  it('carries a patch of all FIVE surviving fields through the boundary intact', () => {
    const dto = received(patch);

    expect(validateSync(dto, { whitelist: true, forbidNonWhitelisted: true })).toEqual([]);
    // The assertion A1-2 is about: the tables are still on the instance the service receives.
    expect(dto.taxRates).toEqual({ default: 0, GB: 0.2, PK: 0.17 });
    expect(dto.currencyRates).toEqual({ usd: 1, gbp: 0.79, pkr: 278 });
    expect(dto.regionCurrency).toEqual({ GB: 'gbp', PK: 'pkr' });
  });

  it('accepts a patch of one table alone — every field stays optional', () => {
    expect(errorsOn({ taxRates: { DE: 0.19 } })).toEqual([]);
    expect(errorsOn({})).toEqual([]);
  });
});

describe('UpdateMonetizationConfigDto — the tables validate what their consumers assume', () => {
  it('refuses a tax rate typed as a percentage', () => {
    // `TaxService` computes `amount * rate`, so 20 means 2000% tax on every subscription. The
    // fraction/percentage confusion is the likeliest way this field gets a wrong value.
    expect(errorsOn({ taxRates: { GB: 20 } })).toEqual(['taxRates']);
  });

  it('refuses a non-numeric rate, which would otherwise persist and NaN every price', () => {
    // `mergeConfig` spreads values through without coercion, so a string here reaches `TaxService`
    // and `amount * "0.2"`… would in fact coerce, but `"20%"` yields NaN. Neither belongs in the
    // stored table, and bare @IsObject() lets both in.
    expect(errorsOn({ taxRates: { GB: '20%' } })).toEqual(['taxRates']);
    expect(errorsOn({ currencyRates: { gbp: 'zero point eight' } })).toEqual(['currencyRates']);
  });

  it('refuses a currency rate of 0 — it would price every plan at nothing', () => {
    expect(errorsOn({ currencyRates: { gbp: 0 } })).toEqual(['currencyRates']);
    expect(errorsOn({ currencyRates: { gbp: -1 } })).toEqual(['currencyRates']);
  });

  it('refuses a non-string currency code in regionCurrency', () => {
    expect(errorsOn({ regionCurrency: { GB: 3 } })).toEqual(['regionCurrency']);
    expect(errorsOn({ regionCurrency: { GB: '' } })).toEqual(['regionCurrency']);
  });

  it('bounds how large a table one patch can grow', () => {
    // `updateConfig` merges and never deletes, and the merged row is read (and cached) on every
    // priced request, so an unbounded table is an unbounded settings row.
    const huge = Object.fromEntries(
      Array.from({ length: 65 }, (_unused, index) => [`R${String(index)}`, 0.1]),
    );
    expect(errorsOn({ taxRates: huge })).toEqual(['taxRates']);
  });

  it('accepts the compiled default tables unchanged — the validators do not reject reality', () => {
    expect(
      errorsOn({
        taxRates: { default: 0, GB: 0.2, DE: 0.19, IN: 0.18, US: 0 },
        currencyRates: { usd: 1, eur: 0.92, gbp: 0.79, inr: 83, pkr: 278 },
        regionCurrency: { US: 'usd', GB: 'gbp', DE: 'eur', IN: 'inr', PK: 'pkr' },
      }),
    ).toEqual([]);
  });
});
