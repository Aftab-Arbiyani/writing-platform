import { AiFeature, EntitlementReason, EntitlementStatus, PlanTier } from '@qalam/shared';
import type { AiFeaturesResponse, AiUsageResponse } from '@qalam/api-types';
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
  useAiUsage: vi.fn(),
}));
vi.mock('@/features/ai/hooks/use-ai-completion', () => ({
  useAiStream: () => ({ start: vi.fn(), cancel: vi.fn() }),
  useAiCompletion: () => ({ mutate: vi.fn() }),
}));

const { monetizationApi } = await import('@/features/monetization/api/monetization.api');
const { isMonetizationEnabled } = await import('@/features/monetization/lib/monetization-enabled');
const { useAiFeatures, useAiUsage } = await import('@/features/ai/hooks/use-ai-meta');

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

const WINDOW = {
  inputTokens: 0,
  outputTokens: 0,
  totalTokens: 0,
  requests: 0,
  estimatedCostUsd: 0,
  tokenLimit: 10_000,
  usedFraction: 0.2,
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
  vi.mocked(useAiUsage).mockReturnValue({
    data: { daily: WINDOW, monthly: WINDOW } as AiUsageResponse,
  } as ReturnType<typeof useAiUsage>);
  useAiEditorTarget.setState({ target: null, storyId: null, open: false });
});

describe('/write — the AI-writing entitlement gate (D3)', () => {
  it('walls a FREE writer out of the assistant, naming the tier and offering plans', async () => {
    entitlements.mockResolvedValue(snapshotWithWriting(false) as never);
    registerEditor();

    renderWithProviders(<WriteRoute />);

    expect(await screen.findByText('AI writing is on Plus and above')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'See plans' })).toBeInTheDocument();
    // The controls are withheld, not merely disabled — a free writer has no route to a generation.
    expect(screen.queryByRole('button', { name: 'Continue writing' })).not.toBeInTheDocument();
  });

  it('walls the Craft Coach too — it is AF2 writing, not a free coaching surface (DECISION 1)', async () => {
    entitlements.mockResolvedValue(snapshotWithWriting(false) as never);
    registerEditor();

    renderWithProviders(<WriteRoute />);
    await screen.findByText('AI writing is on Plus and above');
    fireEvent.click(screen.getByRole('tab', { name: 'Craft Coach' }));

    await waitFor(() => {
      expect(screen.getAllByText('AI writing is on Plus and above').length).toBeGreaterThan(0);
    });
  });

  it('lets an ENTITLED writer straight through to the assistant', async () => {
    entitlements.mockResolvedValue(snapshotWithWriting(true) as never);
    registerEditor();

    renderWithProviders(<WriteRoute />);

    expect(await screen.findByRole('button', { name: 'Continue writing' })).toBeInTheDocument();
    expect(screen.queryByText('AI writing is on Plus and above')).not.toBeInTheDocument();
  });

  it('leaves Ask My Book USABLE for a free writer — permanently, since D4', async () => {
    // The scope regression test, mirroring the server's. Its reason CHANGED on 2026-08-21 without
    // the assertion changing: `ask_book` was an AF4 surface whose gating would have pre-empted a
    // deferred decision, and it is now one of the five codes D4 declared included in every tier. So
    // this is no longer "do not jump ahead of the owner" but "do not contradict them". Free keeps
    // `ai_budget`, so this genuinely works.
    entitlements.mockResolvedValue(snapshotWithWriting(false) as never);
    registerEditor('story-1');

    renderWithProviders(<WriteRoute />);
    await screen.findByText('AI writing is on Plus and above');
    fireEvent.click(screen.getByRole('tab', { name: 'Ask' }));

    // Asserted on the Ask panel's OWN content rather than on the absence of the writing lock:
    // antd keeps inactive tab panels mounted, so the assistant's lock legitimately stays in the
    // DOM. What matters is that the Ask panel rendered its composer instead of a wall.
    await waitFor(() => {
      expect(
        screen.getByPlaceholderText('e.g. How does Aria change by the end?'),
      ).toBeInTheDocument();
    });
  });

  it('gates the Story Explorer INDEPENDENTLY of AI writing', async () => {
    // Plus includes `ai_writing` and NOT `story_intelligence` (D4 granted it to Pro/Enterprise
    // only, confirmed intentional), so a real subscriber sees the assistant and a lock on the
    // graph. One gate standing in for both would have passed a weaker version of this.
    entitlements.mockResolvedValue(snapshotWithWriting(true, false) as never);
    registerEditor('story-1');

    renderWithProviders(<WriteRoute />);
    expect(await screen.findByRole('button', { name: 'Continue writing' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Explorer' }));

    await waitFor(() => {
      expect(screen.getByText('Story intelligence needs a paid plan')).toBeInTheDocument();
    });
  });

  it('lets an entitled writer into the graph', async () => {
    entitlements.mockResolvedValue(snapshotWithWriting(true, true) as never);
    registerEditor('story-1');

    renderWithProviders(<WriteRoute />);
    fireEvent.click(await screen.findByRole('tab', { name: 'Explorer' }));

    // The view selector renders above the query, so this is the tab itself rather than its data —
    // which is the right assertion here: the gate is what is under test, not the graph read.
    await waitFor(() => {
      expect(screen.getByRole('group', { name: 'Explorer view' })).toBeInTheDocument();
    });
    expect(screen.queryByText('Story intelligence needs a paid plan')).not.toBeInTheDocument();
  });

  it('does NOT sell a plan while monetization is dark — it says the feature has not shipped', async () => {
    /*
     * The trap mobile hit first (`story_explorer_screen.dart`). `PremiumGate` fails closed and that
     * includes the client flag being off, so without the dark-launch branch every viewer of a
     * dark-launched deployment would be told a feature that does not exist yet "needs a paid plan"
     * — and sent to a plans page that is itself switched off.
     */
    enabled.mockReturnValue(false);
    entitlements.mockResolvedValue(snapshotWithWriting(false, false) as never);
    registerEditor('story-1');

    renderWithProviders(<WriteRoute />);
    fireEvent.click(await screen.findByRole('tab', { name: 'Explorer' }));

    await waitFor(() => {
      expect(screen.getByText('Story Explorer isn’t available yet')).toBeInTheDocument();
    });
    expect(screen.queryByText('Story intelligence needs a paid plan')).not.toBeInTheDocument();
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
