import {
  DEFAULT_PLAN_FEATURES,
  DEFAULT_PLAN_LIMITS,
  PlanTier,
  PremiumFeature,
  UNLIMITED_SEATS,
  type PlanDefinition,
} from '@qalam/shared';
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '@/test/render';

import { PlanCatalogue } from './plan-catalogue';
import type { AdminPlanCatalogue } from '../types/monetization.types';

/**
 * The rendered plan catalogue (A1a). The pure rules are pinned in `plan-provenance.spec.ts`; this
 * asserts the screen actually SHOWS them, because a correct reader behind a table that never renders
 * it is the same defect as no reader at all.
 */
function tier(name: PlanTier, over: Partial<PlanDefinition> = {}): PlanDefinition {
  return {
    tier: name,
    name,
    description: `${name} plan`,
    features: [...DEFAULT_PLAN_FEATURES[name]],
    limits: { ...DEFAULT_PLAN_LIMITS[name] },
    monthlyCredits: 0,
    prices: {},
    trialDays: 0,
    ...over,
  } as PlanDefinition;
}

function catalogue(over: Partial<Record<PlanTier, PlanDefinition>> = {}): AdminPlanCatalogue {
  return {
    [PlanTier.Free]: tier(PlanTier.Free),
    [PlanTier.Plus]: tier(PlanTier.Plus),
    [PlanTier.Pro]: tier(PlanTier.Pro),
    [PlanTier.Enterprise]: tier(PlanTier.Enterprise),
    ...over,
  } as AdminPlanCatalogue;
}

function render(cat: AdminPlanCatalogue = catalogue()): void {
  renderWithProviders(<PlanCatalogue plans={cat} settingsHref="/settings" />);
}

describe('PlanCatalogue — the inverted sentinel is stated at the field', () => {
  it('marks maxCollaborators as inverted and spells the convention out inline', () => {
    render();

    // Inline, not a tooltip: the note text itself must be in the document.
    const notes = screen.getAllByText(/Inverted sentinel: -1 = unlimited, 0 = none/i);
    expect(notes.length).toBe(4); // one per tier
    expect(screen.getAllByText('inverted').length).toBe(4);
  });

  it('renders Free’s zero seats as None, never as Unlimited', () => {
    render(catalogue({ [PlanTier.Free]: tier(PlanTier.Free) }));

    // DEFAULT_PLAN_LIMITS[free].maxCollaborators is 0, which under the house convention would read
    // "Unlimited" — the exact inverse of what B6 sells.
    expect(screen.getAllByText('None (0)').length).toBeGreaterThan(0);
  });

  it('renders an unlimited seat count with the stored -1 still visible', () => {
    render();

    // Pro + Enterprise ship UNLIMITED_SEATS.
    expect(screen.getAllByText(`Unlimited (${String(UNLIMITED_SEATS)})`).length).toBeGreaterThan(0);
  });

  it('states the ordinary rule on every non-inverted key too', () => {
    render();

    // Absent on the ordinary keys, the note's presence on the odd one would read as decoration.
    expect(screen.getAllByText('0 = unlimited.').length).toBeGreaterThan(4);
  });
});

describe('PlanCatalogue — default vs admin override', () => {
  it('labels a compiled value as a default', () => {
    render();

    expect(screen.getAllByText('default').length).toBeGreaterThan(0);
    expect(screen.queryByText('admin override')).not.toBeInTheDocument();
  });

  it('labels a changed limit as an admin override and shows the default beside it', () => {
    const compiled = DEFAULT_PLAN_LIMITS[PlanTier.Plus];
    // `PlanLimits` carries an index signature, so tsc types a keyed read as possibly-undefined even
    // though the compiled catalogue always ships this key. Assert it rather than casting.
    const compiledMaxPieces = compiled.maxPieces ?? 0;
    render(
      catalogue({
        [PlanTier.Plus]: tier(PlanTier.Plus, { limits: { ...compiled, maxPieces: 4242 } }),
      }),
    );

    expect(screen.getAllByText('admin override').length).toBeGreaterThan(0);
    expect(screen.getByText('4,242')).toBeInTheDocument();
    // The compiled value stays on screen so the operator can see what they diverged from.
    expect(screen.getByText(`default ${compiledMaxPieces.toLocaleString()}`)).toBeInTheDocument();
  });

  it('says a feature list differs, and that a stored list replaces the default wholesale', () => {
    render(
      catalogue({
        [PlanTier.Free]: tier(PlanTier.Free, { features: [PremiumFeature.AiWriting] }),
      }),
    );

    expect(screen.getByText(/Differs from the compiled default/)).toBeInTheDocument();
    expect(screen.getByText(/added ai_writing/)).toBeInTheDocument();
    expect(screen.getByText(/removed ai_budget/)).toBeInTheDocument();
    expect(screen.getByText(/replaces the default outright/)).toBeInTheDocument();
  });
});

describe('PlanCatalogue — which codes actually do something', () => {
  it('marks ai_budget and ai_writing enforced, and D4’s codes not', () => {
    render();

    // Free ships ai_budget only; Plus adds ai_writing plus two of D4's codes.
    expect(screen.getAllByText('enforced').length).toBeGreaterThan(0);
    expect(screen.getAllByText('not enforced').length).toBeGreaterThan(0);
    expect(screen.getAllByText(PremiumFeature.AiWriting).length).toBeGreaterThan(0);
  });

  it('points the operator at Settings, since the catalogue has no admin writer', () => {
    render();

    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute('href', '/settings');
  });
});

describe('PlanCatalogue — a tier missing from the resolved catalogue', () => {
  it('says so instead of rendering an empty card', () => {
    const partial = catalogue();
    // A configuration fault worth seeing, not a blank space.
    delete (partial as Partial<Record<PlanTier, PlanDefinition>>)[PlanTier.Enterprise];
    render(partial);

    expect(screen.getByText(/missing from the resolved catalogue/)).toBeInTheDocument();
  });
});
