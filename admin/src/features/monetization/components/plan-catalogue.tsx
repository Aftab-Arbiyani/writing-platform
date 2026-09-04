import { PLAN_TIER_ORDER, type PlanDefinition, type PlanTier } from '@qalam/shared';
import { QCard, QSectionHeader, QTag } from '@qalam/ui';
import { AlertTriangle, Check, Lock } from 'lucide-react';
import type { ReactElement } from 'react';

import {
  describeLimit,
  featureDelta,
  featureProvenance,
  isEnforcedCode,
  limitKeyLabel,
  limitKeysFor,
  sentinelNote,
  type LimitReading,
  type Provenance,
} from '../lib/plan-provenance';
import type { AdminPlanCatalogue } from '../types/monetization.types';

/**
 * The plan catalogue, read-only (A1a) — the most consequential screen in this row, because B4
 * (piece caps), B6 (collaborator seats), B7 (version history) and D3 (paid AI writing) all resolve
 * their behaviour out of these values.
 *
 * It is read-only because the backend gives it no writer: `MonetizationConfigService.updatePlans`
 * exists but `admin-monetization.controller.ts` exposes no `PATCH plans`, so the catalogue is edited
 * through the generic `monetization.plans` JSON setting on the Settings screen. Rather than hide
 * that, every tier says where to go.
 *
 * Three things it must make legible, and each is a decision rather than a layout choice:
 *
 * 1. **Default vs admin override**, per limit — derived, since the wire carries no provenance.
 * 2. **The inverted sentinel on `maxCollaborators`**, stated INLINE at the field. Not a tooltip: a
 *    convention an operator has to hover to discover is one they will act without.
 * 3. **Which premium codes a tier grants**, and of those, which the server actually enforces —
 *    because granting an unenforced code changes nothing, and an operator should not learn that from
 *    a support ticket.
 */
export interface PlanCatalogueProps {
  plans: AdminPlanCatalogue;
  /** Where an operator goes to actually change these values. */
  settingsHref: string;
}

export function PlanCatalogue({ plans, settingsHref }: PlanCatalogueProps): ReactElement {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-ink-secondary">
        The <strong className="font-medium text-ink">resolved</strong> catalogue: the stored{' '}
        <code className="font-mono text-xs">monetization.plans</code> setting folded over the
        compiled defaults. Values are read-only here &mdash; edit them on the{' '}
        <a href={settingsHref} className="text-accent underline">
          Settings
        </a>{' '}
        screen, which owns that JSON setting.
      </p>
      {PLAN_TIER_ORDER.map((tier) => (
        <TierCard key={tier} tier={tier} plan={plans[tier]} />
      ))}
    </div>
  );
}

function TierCard({
  tier,
  plan,
}: {
  tier: PlanTier;
  plan: PlanDefinition | undefined;
}): ReactElement {
  if (!plan) {
    // A tier the resolved catalogue does not carry. Says so rather than rendering an empty shell —
    // an absent tier is a configuration fault worth seeing, not a blank card.
    return (
      <QCard padding="md">
        <QSectionHeader title={tier} />
        <p className="text-sm text-ink-muted">
          This tier is missing from the resolved catalogue. Check the{' '}
          <code className="font-mono text-xs">monetization.plans</code> setting.
        </p>
      </QCard>
    );
  }

  const readings = limitKeysFor(tier).map((key) => describeLimit(tier, plan.limits, key));
  const featuresFrom = featureProvenance(tier, plan.features);
  const delta = featureDelta(tier, plan.features);

  return (
    <QCard padding="md" className="flex flex-col gap-4">
      <QSectionHeader
        title={
          <span className="flex items-center gap-2">
            {plan.name || tier}
            <span className="font-mono text-xs text-ink-muted">{tier}</span>
          </span>
        }
        description={plan.description}
      />

      <section className="flex flex-col gap-2" aria-label={`${tier} limits`}>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-secondary">Limits</h3>
        <ul className="flex flex-col divide-y divide-line">
          {readings.map((reading) => (
            <LimitRow key={reading.key} reading={reading} />
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-2" aria-label={`${tier} premium features`}>
        <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-ink-secondary">
          Premium features
          <ProvenanceBadge provenance={featuresFrom} />
        </h3>
        {plan.features.length === 0 ? (
          <p className="text-sm text-ink-muted">This tier grants no premium feature codes.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {[...plan.features].sort().map((code) => (
              <li key={code}>
                <FeatureChip code={code} />
              </li>
            ))}
          </ul>
        )}
        {featuresFrom === 'override' ? (
          <p className="text-xs text-ink-muted">
            {/* Array granularity, not per-code: a stored `features` array REPLACES the compiled one
                rather than merging with it, so there is no per-code provenance to report. */}
            Differs from the compiled default
            {delta.added.length > 0 ? <> &middot; added {delta.added.join(', ')}</> : null}
            {delta.removed.length > 0 ? <> &middot; removed {delta.removed.join(', ')}</> : null}. A
            stored feature list replaces the default outright, so the whole list came from the
            setting.
          </p>
        ) : null}
      </section>
    </QCard>
  );
}

function LimitRow({ reading }: { reading: LimitReading }): ReactElement {
  return (
    <li className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="flex items-center gap-2">
          {/*
            The label first, the raw key beside it. D5 added three allowance keys whose names an
            operator cannot decode on sight (`polishActionsPerDay`), and the key still has to be
            visible because it is what they edit in the JSON — so both, rather than choosing.
          */}
          <span className="text-sm text-ink">{limitKeyLabel(reading.key)}</span>
          <code className="font-mono text-xs text-ink-muted">{reading.key}</code>
          <ProvenanceBadge provenance={reading.provenance} />
          {reading.inverted ? (
            <QTag color="warning">
              <span className="flex items-center gap-1">
                <AlertTriangle size={12} strokeWidth={2} aria-hidden />
                inverted
              </span>
            </QTag>
          ) : null}
        </span>
        {/* Stated at the field, unconditionally, for every key — see `sentinelNote`. */}
        <span className="text-xs text-ink-muted">{sentinelNote(reading.key)}</span>
      </div>
      <div className="flex flex-col items-end gap-0.5">
        <span className="text-sm font-medium text-ink [font-variant-numeric:tabular-nums]">
          {reading.display}
        </span>
        {reading.provenance === 'override' && reading.defaultValue !== undefined ? (
          <span className="text-xs text-ink-muted [font-variant-numeric:tabular-nums]">
            default {reading.defaultValue.toLocaleString()}
          </span>
        ) : null}
      </div>
    </li>
  );
}

function ProvenanceBadge({ provenance }: { provenance: Provenance }): ReactElement {
  return provenance === 'override' ? (
    <QTag color="accent">admin override</QTag>
  ) : (
    <QTag color="neutral">default</QTag>
  );
}

/**
 * A granted code, marked with whether the server enforces it.
 *
 * `ai_budget` and `ai_writing` are asserted by the AI usage meter; the other six are computed by the
 * Entitlement Service and checked by nothing (D4, deferred — docs/48 §5.2 consequence 1). Marking
 * that here is the difference between an operator understanding a grant had no effect and filing a
 * bug about it.
 */
function FeatureChip({ code }: { code: string }): ReactElement {
  const enforced = isEnforcedCode(code);
  return (
    <span
      className="flex items-center gap-1.5 rounded-md border border-line bg-raised px-2 py-1"
      title={
        enforced
          ? 'Enforced by a server route today.'
          : 'Computed but not asserted by any route yet — granting it has no effect.'
      }
    >
      {enforced ? (
        <Check size={12} strokeWidth={2.5} className="text-success" aria-hidden />
      ) : (
        <Lock size={12} strokeWidth={2} className="text-ink-muted" aria-hidden />
      )}
      <code className="font-mono text-xs text-ink">{code}</code>
      <span className="text-[10px] uppercase tracking-wide text-ink-muted">
        {enforced ? 'enforced' : 'not enforced'}
      </span>
    </span>
  );
}
