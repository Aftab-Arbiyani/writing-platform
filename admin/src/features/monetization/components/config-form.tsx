import { QButton, QCard, QSectionHeader, useToast } from '@qalam/ui';
import { Plus } from 'lucide-react';
import { useState, type ReactElement } from 'react';

import { ConfirmationDialog } from '@/components/confirmation-dialog';
import { getErrorMessage } from '@/lib/errors';

import { usePatchConfig } from '../hooks/use-monetization';
import {
  TABLE_SPECS,
  tableChanges,
  type ConfigTableKey,
  type TableDraftRow,
} from '../lib/config-tables';
import type {
  AdminMonetizationConfig,
  AdminMonetizationConfigPatch,
} from '../types/monetization.types';

/**
 * The cross-cutting monetization config (A1a, completed by B8) — four numbers and three tables, all
 * seven editable.
 *
 * The tables were read-only until B8 because `UpdateMonetizationConfigDto` declared no properties
 * for them, so the boundary rejected them before the service — which always merged them — ever saw
 * them (A1-2). Now they are edited as rows: each table is `key → value`, a patch MERGES per key
 * server-side, and that has a consequence the operator has to be told once rather than discover —
 * **clearing a row does not delete the key.** The form says so at the table, not in a tooltip.
 *
 * A patch confirms first, because `creditsPerUsd` re-prices every future AI debit platform-wide,
 * `gracePeriodDays` changes how long a failed renewal keeps access, and a tax or currency rate moves
 * what every future subscription costs. The confirmation lists only what actually changed, with
 * before → after, so an operator sees the consequence rather than a generic "are you sure".
 */
const EDITABLE_FIELDS = [
  {
    key: 'creditsPerUsd' as const,
    label: 'Credits per USD',
    hint: 'Converts AI cost into credits on every debit. Changing it re-prices all future AI usage.',
    min: 1,
  },
  {
    key: 'trialDays' as const,
    label: 'Trial days',
    hint: 'Default free-trial length for a plan that does not set its own.',
    min: 0,
  },
  {
    key: 'gracePeriodDays' as const,
    label: 'Grace period (days)',
    hint: 'How long access survives a failed renewal before it ends.',
    min: 0,
  },
  {
    key: 'lowCreditThreshold' as const,
    label: 'Low-credit threshold',
    hint: 'Below this balance the user is warned that credits are running out.',
    min: 0,
  },
];

type EditableKey = (typeof EDITABLE_FIELDS)[number]['key'];
type TableDraft = Record<ConfigTableKey, TableDraftRow[]>;

function initialTableDraft(config: AdminMonetizationConfig): TableDraft {
  const draft = {} as TableDraft;
  for (const spec of TABLE_SPECS) {
    draft[spec.key] = Object.entries(config[spec.key]).map(([key, value]) => ({
      key,
      value: String(value),
    }));
  }
  return draft;
}

export interface ConfigFormProps {
  config: AdminMonetizationConfig;
}

export function ConfigForm({ config }: ConfigFormProps): ReactElement {
  const toast = useToast();
  const patch = usePatchConfig();
  const [draft, setDraft] = useState<Record<EditableKey, string>>(() => ({
    creditsPerUsd: String(config.creditsPerUsd),
    trialDays: String(config.trialDays),
    gracePeriodDays: String(config.gracePeriodDays),
    lowCreditThreshold: String(config.lowCreditThreshold),
  }));
  const [tables, setTables] = useState<TableDraft>(() => initialTableDraft(config));
  const [confirming, setConfirming] = useState(false);

  const changes = EDITABLE_FIELDS.flatMap((field) => {
    const next = Number(draft[field.key]);
    const current = config[field.key];
    if (!Number.isFinite(next) || next === current) return [];
    return [
      { key: String(field.key), label: field.label, from: String(current), to: String(next) },
    ];
  });
  const invalid = EDITABLE_FIELDS.filter((field) => {
    const next = Number(draft[field.key]);
    return !Number.isInteger(next) || next < field.min;
  });

  const tableEdits = TABLE_SPECS.map((spec) => ({
    spec,
    ...tableChanges(spec, config[spec.key], tables[spec.key]),
  }));
  const tableChangeLines = tableEdits.flatMap((edit) =>
    edit.changed.map((change) => ({
      key: `${edit.spec.key}.${change.key}`,
      label: `${edit.spec.label} · ${change.key}`,
      from: change.from,
      to: change.to,
    })),
  );
  const tableInvalid = tableEdits.some((edit) => edit.invalid.length > 0);
  const allChanges = [...changes, ...tableChangeLines];

  const apply = (): void => {
    const body: AdminMonetizationConfigPatch = {};
    for (const field of EDITABLE_FIELDS) {
      const next = Number(draft[field.key]);
      if (Number.isFinite(next) && next !== config[field.key]) {
        body[field.key] = next;
      }
    }
    for (const edit of tableEdits) {
      if (Object.keys(edit.patch).length > 0) {
        // Only the changed keys travel. The server merges, so sending the whole table would be
        // harmless but would make the audit entry unreadable — every patch would look like a
        // rewrite of the entire table.
        Object.assign(body, { [edit.spec.key]: edit.patch });
      }
    }
    patch.mutate(body, {
      onSuccess: () => {
        toast.success('Monetization config updated.');
        setConfirming(false);
      },
      onError: (error) => {
        toast.error(getErrorMessage(error));
        setConfirming(false);
      },
    });
  };

  return (
    <QCard padding="md" className="flex flex-col gap-4">
      <QSectionHeader
        title="Cross-cutting config"
        description="Platform-wide billing behaviour. Applies to every tier."
      />

      <div className="flex flex-col gap-4">
        {EDITABLE_FIELDS.map((field) => {
          const value = draft[field.key];
          const numeric = Number(value);
          const bad = !Number.isInteger(numeric) || numeric < field.min;
          return (
            <div key={field.key} className="flex flex-col gap-1">
              <label htmlFor={`config-${field.key}`} className="text-sm font-medium text-ink">
                {field.label}
              </label>
              <input
                id={`config-${field.key}`}
                type="number"
                inputMode="numeric"
                min={field.min}
                value={value}
                aria-invalid={bad}
                aria-describedby={`config-${field.key}-hint`}
                onChange={(event) => {
                  setDraft((prev) => ({ ...prev, [field.key]: event.target.value }));
                }}
                className="h-9 w-full max-w-xs rounded-md border border-line bg-surface px-3 text-sm text-ink"
              />
              <span id={`config-${field.key}-hint`} className="text-xs text-ink-muted">
                {field.hint}
                {bad ? ` Must be a whole number of at least ${String(field.min)}.` : ''}
              </span>
            </div>
          );
        })}
      </div>

      <section className="flex flex-col gap-4 border-t border-line pt-4">
        <div className="flex flex-col gap-1">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-secondary">
            Tax &amp; currency tables
          </h3>
          <p className="text-xs text-ink-muted">
            Each patch <strong>merges</strong> by key: values you change are written and new rows
            are added, but a row you blank is left as it was. Removing a key means editing the{' '}
            <code className="font-mono">monetization.config</code> setting on the Settings screen.
          </p>
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          {TABLE_SPECS.map((spec) => (
            <TableEditor
              key={spec.key}
              spec={spec}
              rows={tables[spec.key]}
              invalidKeys={tableEdits.find((edit) => edit.spec.key === spec.key)?.invalid ?? []}
              onChange={(rows) => {
                setTables((prev) => ({ ...prev, [spec.key]: rows }));
              }}
            />
          ))}
        </div>
      </section>

      <div className="flex items-center gap-3">
        <QButton
          variant="primary"
          disabled={allChanges.length === 0 || invalid.length > 0 || tableInvalid}
          onClick={() => {
            setConfirming(true);
          }}
        >
          Save changes
        </QButton>
        <span className="text-xs text-ink-muted">
          {allChanges.length === 0
            ? 'No changes.'
            : `${String(allChanges.length)} field${allChanges.length === 1 ? '' : 's'} changed.`}
        </span>
      </div>

      <ConfirmationDialog
        open={confirming}
        danger
        title="Apply monetization config changes?"
        confirmLabel="Apply"
        loading={patch.isPending}
        message={
          <span className="flex flex-col gap-1">
            <span>These take effect platform-wide immediately:</span>
            {allChanges.map((change) => (
              <span key={change.key} className="font-mono text-xs">
                {change.label}: {change.from} &rarr; {change.to}
              </span>
            ))}
            <span>Existing AI debits are not recalculated; future ones use the new values.</span>
          </span>
        }
        onConfirm={apply}
        onCancel={() => {
          setConfirming(false);
        }}
      />
    </QCard>
  );
}

/**
 * One `key → value` table. Keys of EXISTING rows are read-only: renaming a key here would not rename
 * anything server-side — the merge would simply add the new key and leave the old one in place, so
 * an editable key field would quietly duplicate rather than rename.
 */
function TableEditor({
  spec,
  rows,
  invalidKeys,
  onChange,
}: {
  spec: (typeof TABLE_SPECS)[number];
  rows: TableDraftRow[];
  invalidKeys: string[];
  onChange: (rows: TableDraftRow[]) => void;
}): ReactElement {
  const [newKey, setNewKey] = useState('');

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium text-ink">{spec.label}</span>
      <span className="text-xs text-ink-muted">{spec.hint}</span>
      {rows.length === 0 ? (
        <span className="text-xs text-ink-muted">Not configured.</span>
      ) : (
        <ul className="flex flex-col gap-1">
          {rows.map((row, index) => {
            const bad = invalidKeys.includes(row.key);
            const inputId = `config-${spec.key}-${row.key}`;
            return (
              <li key={row.key} className="flex items-center justify-between gap-2">
                <label htmlFor={inputId} className="font-mono text-xs text-ink-secondary">
                  {row.key}
                </label>
                <input
                  id={inputId}
                  type="text"
                  inputMode={spec.kind === 'code' ? 'text' : 'decimal'}
                  value={row.value}
                  aria-invalid={bad}
                  onChange={(event) => {
                    const next = [...rows];
                    next[index] = { key: row.key, value: event.target.value };
                    onChange(next);
                  }}
                  className={`h-8 w-24 rounded-md border bg-surface px-2 text-right text-xs text-ink [font-variant-numeric:tabular-nums] ${
                    bad ? 'border-danger' : 'border-line'
                  }`}
                />
              </li>
            );
          })}
        </ul>
      )}
      {invalidKeys.length === 0 ? null : (
        <span role="alert" className="text-xs text-danger">
          {spec.invalidMessage}
        </span>
      )}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={newKey}
          aria-label={`Add a ${spec.label} key`}
          placeholder={spec.keyPlaceholder}
          onChange={(event) => {
            setNewKey(event.target.value);
          }}
          className="h-8 w-24 rounded-md border border-line bg-surface px-2 text-xs text-ink"
        />
        <QButton
          variant="secondary"
          size="sm"
          // Three tables sit on this screen, so three buttons reading only "Add" gave a screen-reader
          // user no way to tell which table they were adding to. Naming the table keeps the visible
          // word "Add" at the front of the accessible name (WCAG 2.5.3) and lets a test address one
          // table instead of trusting the render order.
          aria-label={`Add ${spec.label} row`}
          disabled={newKey.trim() === '' || rows.some((row) => row.key === newKey.trim())}
          onClick={() => {
            onChange([...rows, { key: newKey.trim(), value: spec.newRowDefault }]);
            setNewKey('');
          }}
        >
          <Plus size={14} strokeWidth={2} aria-hidden /> Add
        </QButton>
      </div>
    </div>
  );
}
