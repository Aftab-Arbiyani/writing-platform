import { QButton, QCard, QSectionHeader, useToast } from '@qalam/ui';
import { Lock } from 'lucide-react';
import { useState, type ReactElement } from 'react';

import { ConfirmationDialog } from '@/components/confirmation-dialog';
import { getErrorMessage } from '@/lib/errors';

import { usePatchConfig } from '../hooks/use-monetization';
import type {
  AdminMonetizationConfig,
  AdminMonetizationConfigPatch,
} from '../types/monetization.types';

/**
 * The cross-cutting monetization config (A1a) — four editable numbers and three read-only tables.
 *
 * **The split is the backend's, not a design choice.** `UpdateMonetizationConfigDto` declares
 * properties for `creditsPerUsd`, `trialDays`, `gracePeriodDays` and `lowCreditThreshold` only. The
 * service layer would happily merge `taxRates`, `currencyRates` and `regionCurrency` — the patch type
 * has them — but with no DTO property they are stripped before they reach it, so `PATCH config`
 * cannot write them. They are shown, marked read-only, and the operator is told where the values
 * actually live (recorded as A1-2 in docs/48 §3).
 *
 * A patch confirms first, because `creditsPerUsd` re-prices every future AI debit platform-wide and
 * `gracePeriodDays` changes how long a failed renewal keeps access. The confirmation lists only the
 * fields that actually changed, with before → after, so an operator sees the consequence rather than
 * a generic "are you sure".
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
  const [confirming, setConfirming] = useState(false);

  const changes = EDITABLE_FIELDS.flatMap((field) => {
    const next = Number(draft[field.key]);
    const current = config[field.key];
    if (!Number.isFinite(next) || next === current) return [];
    return [{ ...field, from: current, to: next }];
  });
  const invalid = EDITABLE_FIELDS.filter((field) => {
    const next = Number(draft[field.key]);
    return !Number.isInteger(next) || next < field.min;
  });

  const apply = (): void => {
    const body: AdminMonetizationConfigPatch = {};
    for (const change of changes) {
      body[change.key] = change.to;
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

      <div className="flex items-center gap-3">
        <QButton
          variant="primary"
          disabled={changes.length === 0 || invalid.length > 0}
          onClick={() => {
            setConfirming(true);
          }}
        >
          Save changes
        </QButton>
        <span className="text-xs text-ink-muted">
          {changes.length === 0
            ? 'No changes.'
            : `${String(changes.length)} field${changes.length === 1 ? '' : 's'} changed.`}
        </span>
      </div>

      <ReadOnlyTables config={config} />

      <ConfirmationDialog
        open={confirming}
        danger
        title="Apply monetization config changes?"
        confirmLabel="Apply"
        loading={patch.isPending}
        message={
          <span className="flex flex-col gap-1">
            <span>These take effect platform-wide immediately:</span>
            {changes.map((change) => (
              <span key={change.key} className="font-mono text-xs">
                {change.label}: {change.from.toLocaleString()} &rarr; {change.to.toLocaleString()}
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
 * The three tables `PATCH config` cannot write. Rendered because an operator needs to SEE the tax
 * and currency values that price a subscription, and told plainly that this screen cannot change
 * them — a disabled input with no explanation reads as a bug.
 */
function ReadOnlyTables({ config }: { config: AdminMonetizationConfig }): ReactElement {
  const tables: Array<{ label: string; entries: Array<[string, string]> }> = [
    {
      label: 'Tax rates',
      entries: Object.entries(config.taxRates).map(([k, v]) => [k, `${String(v * 100)}%`]),
    },
    {
      label: 'Currency rates (vs USD)',
      entries: Object.entries(config.currencyRates).map(([k, v]) => [k, String(v)]),
    },
    {
      label: 'Region → currency',
      entries: Object.entries(config.regionCurrency).map(([k, v]) => [k, v]),
    },
  ];

  return (
    <section className="flex flex-col gap-3 border-t border-line pt-4">
      <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-ink-secondary">
        <Lock size={12} strokeWidth={2} aria-hidden />
        Read-only here
      </h3>
      <p className="text-xs text-ink-muted">
        The monetization config endpoint accepts only the four numbers above &mdash; it has no
        fields for these tables, so they cannot be edited from this screen. Change them through the{' '}
        <code className="font-mono">monetization.config</code> setting on the Settings screen.
      </p>
      <div className="grid gap-4 sm:grid-cols-3">
        {tables.map((table) => (
          <div key={table.label} className="flex flex-col gap-1">
            <span className="text-xs font-medium text-ink">{table.label}</span>
            {table.entries.length === 0 ? (
              <span className="text-xs text-ink-muted">Not configured.</span>
            ) : (
              <dl className="flex flex-col gap-0.5">
                {table.entries.map(([key, value]) => (
                  <div key={key} className="flex justify-between gap-2 text-xs">
                    <dt className="font-mono text-ink-secondary">{key}</dt>
                    <dd className="text-ink [font-variant-numeric:tabular-nums]">{value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
