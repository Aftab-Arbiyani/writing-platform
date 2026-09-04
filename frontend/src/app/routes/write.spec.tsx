import { AiFeature, EntitlementReason, EntitlementStatus, PlanTier } from '@qalam/shared';
import type { AiFeaturesResponse } from '@qalam/api-types';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';

import { useAiEditorTarget } from '@/stores/ai-editor-target.store';
import { renderWithProviders } from '@/test/render';

import { Component as WriteRoute } from './write';

/**
 * D3 (docs/45 §4 row D3, docs/48 §6.13) — the `/write` route is where AI writing is actually gated,
 * so it is where the gate is tested.
 *
 * The composition is the thing under test, not any one component: `features/ai` may not import
 * `features/monetization` (docs/26 §4), so the panel takes the gate as a prop and this route is the
 * only place the two meet. A test inside either feature would prove nothing about whether they were
 * wired together. Monetization's real `PremiumGate` runs here — only its API call is stubbed.
 *
 * ⚠️ These assertions encode a deliberate REGRESSION: a free writer who could use the assistant
 * yesterday cannot today. Flagged before the owner's decision and accepted.
 */

vi.mock('@/features/writing', () => ({
  // The editor is `features/writing`'s concern and is heavy; the route's job is to hand it an
  // `assistant` slot, so the stub renders exactly that slot and nothing else.
  EditorPage: ({ assistant }: { assistant: ReactNode }) => <div>{assistant}</div>,
}));

vi.mock('@/features/monetization/api/monetization.api');
vi.mock('@/features/monetization/lib/monetization-enabled');
vi.mock('@/features/ai/hooks/use-ai-meta', () => ({
  useAiFeatures: vi.fn(),
}));
vi.mock('@/features/ai/hooks/use-ai-completion', () => ({
  useAiStream: () => ({ start: vi.fn(), cancel: vi.fn() }),
  useAiCompletion: () => ({ mutate: vi.fn() }),
}));

const { monetizationApi } = await import('@/features/monetization/api/monetization.api');
const { isMonetizationEnabled } = await import('@/features/monetization/lib/monetization-enabled');
const { useAiFeatures } = await import('@/features/ai/hooks/use-ai-meta');

const entitlements = vi.mocked(monetizationApi.entitlements);
const enabled = vi.mocked(isMonetizationEnabled);

const FEATURES: AiFeaturesResponse = {
  aiEnabled: true,
  userAiEnabled: true,
  features: [
    {
      feature: AiFeature.WritingAssistant,
      flagKey: 'feature.ai.writingAssistant.enabled',
      enabled: true,
    },
    { feature: AiFeature.CraftCoach, flagKey: 'feature.ai.craftCoach.enabled', enabled: true },
  ],
};

/**
 * A snapshot in which `ai_writing` is decided and `ai_budget` is always granted (DECISION 2a).
 *
 * `storyIntelligence` defaults to DENIED because that is the free tier's real answer — D4 granted
 * the code to Pro and Enterprise but deliberately not to Plus, so "entitled to writing" and
 * "entitled to the graph" are genuinely independent and the tests must be able to say so.
 */
function snapshotWithWriting(allowed: boolean, storyIntelligence = false) {
  const decide = (feature: string, ok: boolean) => ({
    feature: feature as never,
    status: (ok ? EntitlementStatus.Allow : EntitlementStatus.Deny) as never,
    allowed: ok,
    reason: (ok ? EntitlementReason.PlanIncludes : EntitlementReason.PlanExcludes) as never,
    expiresAt: null,
    remaining: null,
    limit: null,
  });
  return {
    tier: allowed ? PlanTier.Plus : PlanTier.Free,
    status: EntitlementStatus.Allow,
    features: [
      decide('ai_writing', allowed),
      decide('ai_budget', true),
      decide('story_intelligence', storyIntelligence),
    ],
    refreshAt: null,
  };
}

function registerEditor(storyId: string | null = null): void {
  useAiEditorTarget.setState({
    open: true,
    storyId,
    target: {
      getContext: () => ({
        selectionText: '',
        documentText: 'The whole draft.',
        title: 'A door',
        language: 'en',
        wordCount: 3,
      }),
      apply: vi.fn().mockReturnValue(true),
    },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  enabled.mockReturnValue(true);
  vi.mocked(useAiFeatures).mockReturnValue({ data: FEATURES } as ReturnType<typeof useAiFeatures>);
  useAiEditorTarget.setState({ target: null, storyId: null, open: false });
});

describe('/write — the writing-tools entitlement gate (D3)', () => {
  it('walls a FREE writer out of the assistant, naming the tier and offering plans', async () => {
    entitlements.mockResolvedValue(snapshotWithWriting(false) as never);
    registerEditor();

    renderWithProviders(<WriteRoute />);

    expect(await screen.findByText('Polish & feedback is on Plus and above')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'See plans' })).toBeInTheDocument();
    // The controls are withheld, not merely disabled — a free writer has no route to a request.
    expect(screen.queryByRole('button', { name: 'Condense' })).not.toBeInTheDocument();
  });

  it('walls Manuscript feedback too — same premium code, so the same wall (DECISION 1)', async () => {
    entitlements.mockResolvedValue(snapshotWithWriting(false) as never);
    registerEditor();

    renderWithProviders(<WriteRoute />);
    await screen.findByText('Polish & feedback is on Plus and above');
    fireEvent.click(screen.getByRole('tab', { name: 'Feedback' }));

    await waitFor(() => {
      expect(screen.getAllByText('Polish & feedback is on Plus and above').length).toBeGreaterThan(
        0,
      );
    });
  });

  it('lets an ENTITLED writer straight through to Polish', async () => {
    entitlements.mockResolvedValue(snapshotWithWriting(true) as never);
    registerEditor();

    renderWithProviders(<WriteRoute />);

    expect(await screen.findByRole('button', { name: 'Condense' })).toBeInTheDocument();
    expect(screen.queryByText('Polish & feedback is on Plus and above')).not.toBeInTheDocument();
  });

  /**
   * D5 deleted the case that sat here: "leaves Ask My Book USABLE for a free writer". It was the
   * scope regression test for D4's decision that `ask_book` is included in every tier — a real
   * constraint, and one that stops existing when the surface does. The gate's SCOPE is still pinned,
   * by the two Story Map cases below: one code walls one tab and not its neighbours.
   */
  it('gates Story Map INDEPENDENTLY of the writing tools', async () => {
    // Plus includes `ai_writing` and NOT `story_intelligence` (D4 granted it to Pro/Enterprise
    // only, confirmed intentional), so a real subscriber sees Polish and a lock on the map. One
    // gate standing in for both would have passed a weaker version of this.
    entitlements.mockResolvedValue(snapshotWithWriting(true, false) as never);
    registerEditor('story-1');

    renderWithProviders(<WriteRoute />);
    expect(await screen.findByRole('button', { name: 'Condense' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Story Map' }));

    await waitFor(() => {
      expect(screen.getByText('Story Map is on Pro and above')).toBeInTheDocument();
    });
  });

  it('lets an entitled writer into the graph', async () => {
    entitlements.mockResolvedValue(snapshotWithWriting(true, true) as never);
    registerEditor('story-1');

    renderWithProviders(<WriteRoute />);
    fireEvent.click(await screen.findByRole('tab', { name: 'Story Map' }));

    // The view selector renders above the query, so this is the tab itself rather than its data —
    // which is the right assertion here: the gate is what is under test, not the graph read.
    await waitFor(() => {
      expect(screen.getByRole('group', { name: 'Story Map view' })).toBeInTheDocument();
    });
    expect(screen.queryByText('Story Map is on Pro and above')).not.toBeInTheDocument();
  });

  it('does NOT sell a plan while monetization is dark — it says the feature has not shipped', async () => {
    /*
     * The trap mobile hit first (`story_explorer_screen.dart`). `PremiumGate` fails closed and that
     * includes the client flag being off, so without the dark-launch branch every viewer of a
     * dark-launched deployment would be told a feature that does not exist yet needs a paid plan
     * — and sent to a plans page that is itself switched off.
     */
    enabled.mockReturnValue(false);
    entitlements.mockResolvedValue(snapshotWithWriting(false, false) as never);
    registerEditor('story-1');

    renderWithProviders(<WriteRoute />);
    fireEvent.click(await screen.findByRole('tab', { name: 'Story Map' }));

    await waitFor(() => {
      expect(screen.getByText('Story Map isn’t available yet')).toBeInTheDocument();
    });
    expect(screen.queryByText('Story Map is on Pro and above')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'See plans' })).not.toBeInTheDocument();
  });

  it('fails closed when the entitlement snapshot cannot be read', async () => {
    // PremiumGate's existing posture, restated here because D3 is what made it load-bearing for
    // this surface: being briefly too strict costs a late-appearing control, while being permissive
    // shows one that then 402s.
    entitlements.mockRejectedValue(new Error('offline'));
    registerEditor();

    renderWithProviders(<WriteRoute />);

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Continue writing' })).not.toBeInTheDocument();
    });
  });
});
