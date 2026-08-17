import type { AdminMonetizationConfig } from '../types/monetization.types';

/**
 * The three `key → value` config tables, and the pure rules for editing them (B8, closing A1-2).
 *
 * Extracted from the form because the interesting parts are decisions, not markup: which values a
 * table accepts, what "changed" means when the server MERGES rather than replaces, and which keys
 * travel in a patch. Each rule mirrors the DTO validator the server now applies
 * (`monetization-request.dto.ts`), so the form refuses what the boundary would refuse and the
 * operator learns it before a round trip rather than from a 400.
 */
export type ConfigTableKey = 'taxRates' | 'currencyRates' | 'regionCurrency';

/** One row of a table as it is being edited — the value stays a string until it is parsed. */
export interface TableDraftRow {
  key: string;
  value: string;
}

export interface TableChange {
  key: string;
  from: string;
  to: string;
}

export interface TableSpec {
  key: ConfigTableKey;
  label: string;
  hint: string;
  kind: 'rate' | 'multiplier' | 'code';
  keyPlaceholder: string;
  /** What a freshly added row starts at — a value that is valid, so the row is never born invalid. */
  newRowDefault: string;
  invalidMessage: string;
}

export const TABLE_SPECS: readonly TableSpec[] = [
  {
    key: 'taxRates',
    label: 'Tax rates',
    hint: 'Region → rate as a fraction. 0.2 is 20%. The `default` key applies where no region matches.',
    kind: 'rate',
    keyPlaceholder: 'GB',
    newRowDefault: '0',
    invalidMessage: 'A tax rate is a fraction between 0 and 1 — enter 0.2 for 20%, not 20.',
  },
  {
    key: 'currencyRates',
    label: 'Currency rates (vs USD)',
    hint: 'Currency → multiplier against USD, which is 1.',
    kind: 'multiplier',
    keyPlaceholder: 'gbp',
    newRowDefault: '1',
    invalidMessage:
      'A currency rate must be greater than 0 — a 0 would price every plan at nothing.',
  },
  {
    key: 'regionCurrency',
    label: 'Region → currency',
    hint: 'Region → the currency its prices are quoted in.',
    kind: 'code',
    keyPlaceholder: 'GB',
    newRowDefault: 'usd',
    invalidMessage: 'Enter a currency code.',
  },
] as const;

/** `null` when the raw text is not something this table can hold. */
export function parseTableValue(spec: TableSpec, raw: string): number | string | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  if (spec.kind === 'code') return trimmed;

  const numeric = Number(trimmed);
  if (!Number.isFinite(numeric)) return null;
  if (spec.kind === 'rate') return numeric >= 0 && numeric <= 1 ? numeric : null;
  return numeric > 0 ? numeric : null;
}

/**
 * What this draft would change, what it would send, and which rows are unusable.
 *
 * **A blanked row is left alone rather than treated as a deletion**, and that is the honest reading
 * of the endpoint: `updateConfig` spreads the patch over the current table, so a key can be added or
 * overwritten but never removed. Sending an empty string would either fail validation or write
 * nonsense; silently dropping the key from the patch is what actually matches the server. The form
 * states this above the tables, because a rule the UI enforces silently is a rule the operator will
 * fight.
 */
export function tableChanges(
  spec: TableSpec,
  current: AdminMonetizationConfig[ConfigTableKey],
  rows: TableDraftRow[],
): { changed: TableChange[]; patch: Record<string, number | string>; invalid: string[] } {
  const changed: TableChange[] = [];
  const patch: Record<string, number | string> = {};
  const invalid: string[] = [];

  for (const row of rows) {
    const existing = (current as Record<string, number | string | undefined>)[row.key];
    const isNew = existing === undefined;
    const parsed = parseTableValue(spec, row.value);

    if (parsed === null) {
      // A blank on an EXISTING row is "leave it"; a blank on a row the operator just added, or a
      // value that cannot be parsed at all, is a mistake worth flagging.
      if (row.value.trim() !== '' || isNew) invalid.push(row.key);
      continue;
    }
    if (!isNew && String(existing) === String(parsed)) continue;

    changed.push({ key: row.key, from: isNew ? '(new)' : String(existing), to: String(parsed) });
    patch[row.key] = parsed;
  }

  return { changed, patch, invalid };
}
