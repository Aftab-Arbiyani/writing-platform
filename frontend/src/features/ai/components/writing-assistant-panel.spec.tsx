import { AiFeature } from '@qalam/shared';
import type { AiFeaturesResponse, AiUsageResponse } from '@qalam/api-types';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';

import { useAiEditorTarget, type AiEditorTarget } from '@/stores/ai-editor-target.store';
import { renderWithProviders } from '@/test/render';

import { useAiFeatures, useAiUsage } from '../hooks/use-ai-meta';
import { useAiStreamStore } from '../stores/ai-stream.store';
import { useAskBookStore } from '../stores/ask-book.store';
import { WritingAssistantPanel } from './writing-assistant-panel';

vi.mock('../hooks/use-ai-meta', () => ({ useAiFeatures: vi.fn(), useAiUsage: vi.fn() }));
// The stream itself is AF1 and already covered; here we drive the store directly so the panel's
// own behaviour (gating, accept/discard) is what is under test.
const start = vi.fn();
vi.mock('../hooks/use-ai-completion', () => ({
  useAiStream: () => ({ start, cancel: vi.fn() }),
  useAiCompletion: () => ({ mutate: vi.fn() }),
}));

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
const USAGE = { daily: WINDOW, monthly: WINDOW } as AiUsageResponse;

const apply = vi.fn().mockReturnValue(true);

/**
 * Renders the panel with PASS-THROUGH gates.
 *
 * The gates themselves are monetization's `PremiumGate`, supplied by `app/routes/write.tsx` and
 * covered by `write-route-gate.spec.tsx` — these tests are about the panel's own behaviour, so the
 * seams are held open here rather than exercised. Both props are REQUIRED (`writingGate` for D3,
 * `explorerGate` for D4), so a future test cannot forget either exists.
 */
function renderPanel(
  writingGate: (children: ReactNode) => ReactNode = (children) => children,
  explorerGate: (children: ReactNode) => ReactNode = (children) => children,
): ReturnType<typeof renderWithProviders> {
  return renderWithProviders(
    <WritingAssistantPanel writingGate={writingGate} explorerGate={explorerGate} />,
  );
}

function mockMeta(features: AiFeaturesResponse | undefined, usage: AiUsageResponse | undefined) {
  vi.mocked(useAiFeatures).mockReturnValue({ data: features } as ReturnType<typeof useAiFeatures>);
  vi.mocked(useAiUsage).mockReturnValue({ data: usage } as ReturnType<typeof useAiUsage>);
}

function registerTarget(
  over: Partial<ReturnType<AiEditorTarget['getContext']>> = {},
  storyId: string | null = null,
): void {
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
        ...over,
      }),
      apply,
    },
  });
}

describe('WritingAssistantPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apply.mockReturnValue(true);
    useAiStreamStore.getState().reset();
    useAskBookStore.getState().reset();
    useAiEditorTarget.setState({ target: null, storyId: null, open: false });
    mockMeta(FEATURES, USAGE);
  });

  it('renders nothing when no editor has registered', () => {
    useAiEditorTarget.setState({ open: true, target: null });
    renderPanel();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('offers the quick actions once an editor is registered', () => {
    registerTarget();
    renderPanel();
    expect(screen.getByRole('button', { name: 'Continue writing' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rewrite' })).toBeInTheDocument();
  });

  it('sends the action’s prompt key and the document as the operand', async () => {
    registerTarget();
    renderPanel();

    fireEvent.click(screen.getByRole('button', { name: 'Rewrite' }));

    await waitFor(() => {
      expect(start).toHaveBeenCalled();
    });
    expect(start.mock.calls[0]?.[0]).toMatchObject({
      feature: AiFeature.WritingAssistant,
      promptKey: 'writing_assistant.rewrite',
      messages: [{ role: 'user', content: 'The whole draft.' }],
    });
  });

  it('tells the writer whether it is working on the selection or the whole draft', () => {
    registerTarget({ selectionText: 'a phrase' });
    renderPanel();
    expect(screen.getByText('Working on your selection.')).toBeInTheDocument();
  });

  it('walls off the surface when the allowance is spent — before anything is typed', () => {
    // The state W2 required from day one: metering is routine, so this must be a first-class
    // state, not an error surfaced after the writer composes a request.
    mockMeta(FEATURES, {
      daily: { ...WINDOW, usedFraction: 1 },
      monthly: WINDOW,
    } as AiUsageResponse);
    registerTarget();
    renderPanel();

    expect(screen.getByText('You’ve used your AI allowance')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Rewrite' })).not.toBeInTheDocument();
  });

  it('walls off the surface when the feature flag is down', () => {
    mockMeta(
      {
        aiEnabled: true,
        userAiEnabled: true,
        features: [
          {
            feature: AiFeature.WritingAssistant,
            flagKey: 'feature.ai.writingAssistant.enabled',
            enabled: false,
          },
        ],
      },
      USAGE,
    );
    registerTarget();
    renderPanel();
    expect(screen.getByText('Not available yet')).toBeInTheDocument();
  });

  it('walls off the surface when a request comes back over quota mid-flight', () => {
    registerTarget();
    useAiStreamStore.setState({ status: 'error', errorCode: 'QUOTA_EXCEEDED' });
    renderPanel();
    expect(screen.getByText('You’ve used your AI allowance')).toBeInTheDocument();
  });

  it('applies an accepted suggestion through the editor target, never directly', () => {
    registerTarget();
    useAiStreamStore.setState({ status: 'done', text: 'A suggested line.' });
    renderPanel();

    // No selection, so a one-click accept inserts below rather than replacing the draft.
    fireEvent.click(screen.getByRole('button', { name: /Insert below/ }));
    expect(apply).toHaveBeenCalledWith('A suggested line.', 'insert-below');
  });

  it('discards a suggestion without touching the document', () => {
    registerTarget();
    useAiStreamStore.setState({ status: 'done', text: 'A suggested line.' });
    renderPanel();

    fireEvent.click(screen.getByRole('button', { name: /Discard/ }));
    expect(apply).not.toHaveBeenCalled();
    expect(useAiStreamStore.getState().text).toBe('');
  });

  it('exposes the Craft Coach as its own tab', () => {
    registerTarget();
    renderPanel();
    expect(screen.getByRole('tab', { name: 'Craft Coach' })).toBeInTheDocument();
  });

  /**
   * W9's two story-scoped surfaces. Both take the SERVER piece id and are owner-scoped server-side,
   * so a draft that has never synced has no story to explore — the web reading of mobile's
   * `st.draft.isRemote` gate (`editor_screen.dart:245`).
   */
  it('hides the Explorer until the draft has a server id', () => {
    registerTarget({}, null);
    renderPanel();
    expect(screen.queryByRole('tab', { name: 'Explorer' })).not.toBeInTheDocument();
  });

  it('offers the Explorer once the draft has synced', () => {
    registerTarget({}, 'piece-1');
    renderPanel();
    expect(screen.getByRole('tab', { name: 'Explorer' })).toBeInTheDocument();
  });

  /**
   * D4 (decided 2026-08-21, docs/48 §5.2): `story_intelligence` is the ONE premium code of the six
   * that D4 chose to enforce, so the Explorer body goes through the entitlement gate — and Ask My
   * Book, which the same decision declared included in every tier, must not.
   *
   * Asserted by COUNTING the gate's sentinel across both story-scoped tabs. AntD mounts a tabpanel
   * on first activation and then keeps it mounted, so visiting Explorer and Ask and still finding
   * exactly one occurrence is what proves one tab is wrapped and the other is not — a `queryByText`
   * on the inactive tab would find the retained one and pass for the wrong reason.
   */
  it('puts ONLY the Explorer body behind the entitlement gate (D4)', () => {
    registerTarget({}, 'piece-1');
    renderPanel(
      (children) => children,
      () => <p>story intelligence locked</p>,
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Explorer' }));
    expect(screen.getAllByText('story intelligence locked')).toHaveLength(1);

    fireEvent.click(screen.getByRole('tab', { name: 'Ask' }));
    expect(screen.getAllByText('story intelligence locked')).toHaveLength(1);
  });

  it('leaves Ask My Book reachable while the Explorer is locked', () => {
    // The half of D4 that is a decision rather than a gate: five codes were declared free, and
    // `ask_book` is one of them. A gate that took this tab with it would contradict that.
    registerTarget({}, 'piece-1');
    renderPanel(
      (children) => children,
      () => <p>story intelligence locked</p>,
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Ask' }));
    expect(screen.getByRole('tab', { name: 'Ask' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByText('That feature needs a paid plan.')).not.toBeInTheDocument();
  });

  /**
   * Precedence, and it is the same order mobile applies: a writer whose instance has AI switched
   * off cannot act on "this needs a paid plan", so availability answers first and the gate never
   * runs. Pinned because the two are independent and the wrong order is invisible in review.
   */
  it('says AI is off rather than offering a plan, when both would apply', () => {
    mockMeta({ aiEnabled: false, userAiEnabled: true, features: [] }, USAGE);
    registerTarget({}, 'piece-1');
    renderPanel(
      (children) => children,
      () => <p>story intelligence locked</p>,
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Explorer' }));
    expect(screen.getAllByText('AI is turned off').length).toBeGreaterThan(0);
    expect(screen.queryByText('story intelligence locked')).not.toBeInTheDocument();
  });

  /**
   * The explorer's route carries `ai.use` and no feature flag, and makes no model call. Gating it on
   * a neighbouring flag would hide a surface the server would have served — the mistake mobile's
   * editor calls out by name at `editor_screen.dart:241-244`.
   */
  it('offers the Explorer even when every AI feature flag is down', () => {
    mockMeta({ aiEnabled: true, userAiEnabled: true, features: [] }, USAGE);
    registerTarget({}, 'piece-1');
    renderPanel();
    expect(screen.getByRole('tab', { name: 'Explorer' })).toBeInTheDocument();
  });

  /** It spends no tokens, so a spent allowance is not a reason to lock a writer out of it. */
  it('offers the Explorer even when the allowance is spent', () => {
    mockMeta(FEATURES, {
      daily: { ...WINDOW, usedFraction: 1 },
      monthly: WINDOW,
    } as AiUsageResponse);
    registerTarget({}, 'piece-1');
    renderPanel();
    expect(screen.getByRole('tab', { name: 'Explorer' })).toBeInTheDocument();
  });

  it('walls off the Explorer when AI is off entirely', () => {
    mockMeta({ aiEnabled: false, userAiEnabled: true, features: [] }, USAGE);
    registerTarget({}, 'piece-1');
    renderPanel();

    fireEvent.click(screen.getByRole('tab', { name: 'Explorer' }));
    expect(screen.getAllByText('AI is turned off').length).toBeGreaterThan(0);
  });

  /**
   * B5 (docs/45 §4.10) — the same payload shape, one field different, and every tab has to
   * say something else. This is the reachability check the spec asks for: not "does the
   * resolver return self-off" (that is unit-tested) but "does a writer who turned AI off
   * actually see their own switch named on the surface they were using".
   */
  it('tells a writer who turned AI off that it was THEM, on every tab', () => {
    mockMeta({ aiEnabled: false, userAiEnabled: false, features: [] }, USAGE);
    registerTarget({}, 'piece-1');
    renderPanel();

    for (const tab of ['Assistant', 'Craft Coach', 'Explorer', 'Ask']) {
      fireEvent.click(screen.getByRole('tab', { name: tab }));
      expect(screen.getAllByText('You turned AI off').length).toBeGreaterThan(0);
      // Never the platform copy — the remedy would be wrong (docs/48 §3.6).
      expect(screen.queryByText('AI is turned off')).not.toBeInTheDocument();
    }
  });

  it('hides Ask until the draft has a server id, then offers it', () => {
    registerTarget({}, null);
    const { unmount } = renderPanel();
    expect(screen.queryByRole('tab', { name: 'Ask' })).not.toBeInTheDocument();
    unmount();

    registerTarget({}, 'piece-1');
    renderPanel();
    expect(screen.getByRole('tab', { name: 'Ask' })).toBeInTheDocument();
  });

  /**
   * Unlike the explorer, `POST /ai/ask` IS flagged (`ai.use` + the AskBook feature), and AF1 seeds
   * every feature flag disabled — so this dark state is the starting state of every deployment.
   */
  it('walls off Ask when the AskBook flag is down, while the Explorer stays open', () => {
    mockMeta(
      {
        aiEnabled: true,
        userAiEnabled: true,
        features: [
          { feature: AiFeature.AskBook, flagKey: 'feature.ai.askBook.enabled', enabled: false },
        ],
      },
      USAGE,
    );
    registerTarget({}, 'piece-1');
    renderPanel();

    fireEvent.click(screen.getByRole('tab', { name: 'Ask' }));
    expect(screen.getAllByText('Not available yet').length).toBeGreaterThan(0);
    // The explorer needs no flag, so the same response leaves it usable.
    expect(screen.getByRole('tab', { name: 'Explorer' })).toBeInTheDocument();
  });

  /**
   * The reason Ask streams into its own store: the two surfaces share a drawer, and a wall the
   * assistant hit must not present as a wall on a request the writer never made.
   */
  it('keeps a mid-flight wall on one surface from walling the other', () => {
    registerTarget({}, 'piece-1');
    useAiStreamStore.setState({ status: 'error', errorCode: 'QUOTA_EXCEEDED' });
    renderPanel();

    // The assistant is walled…
    expect(screen.getByText('You’ve used your AI allowance')).toBeInTheDocument();
    // …and Ask still offers its controls, because its own stream has not failed.
    fireEvent.click(screen.getByRole('tab', { name: 'Ask' }));
    expect(screen.getByRole('button', { name: 'Whole book' })).toBeInTheDocument();
  });

  it('walls off Ask when ITS stream comes back over quota', () => {
    registerTarget({}, 'piece-1');
    useAskBookStore.setState({ status: 'error', errorCode: 'ENTITLEMENT_DENIED' });
    renderPanel();

    fireEvent.click(screen.getByRole('tab', { name: 'Ask' }));
    expect(screen.getAllByText('This needs a paid plan').length).toBeGreaterThan(0);
  });

  /**
   * D3, and the case the gate alone cannot cover: the entitlement can be revoked (or the payments
   * flag raised) BETWEEN the page load that resolved the gate and the generation itself. The
   * refusal arrives as a 402 on the STREAM, so it lands in `errorCode` rather than in the
   * entitlement snapshot, and it must read as the same wall the gate would have shown.
   */
  it('renders the AI-writing wall when a 402 arrives mid-STREAM, not the allowance wall', () => {
    registerTarget({}, 'piece-1');
    useAiStreamStore.setState({ status: 'error', errorCode: 'ENTITLEMENT_DENIED' });
    renderPanel();

    expect(screen.getByText('AI writing is on Plus and above')).toBeInTheDocument();
    // Not the `ai_budget` copy: free KEEPS its allowance under DECISION 2a, so telling the writer
    // their plan has no AI allowance would be false as well as the wrong remedy (48 §3.6).
    expect(screen.queryByText('This needs a paid plan')).not.toBeInTheDocument();
    expect(screen.queryByText('You\u2019ve used your AI allowance')).not.toBeInTheDocument();
  });

  it('keeps the coach on the same mid-stream wall, since it is the same premium code', () => {
    registerTarget({}, 'piece-1');
    useAiStreamStore.setState({ status: 'error', errorCode: 'ENTITLEMENT_DENIED' });
    renderPanel();

    fireEvent.click(screen.getByRole('tab', { name: 'Craft Coach' }));
    expect(screen.getAllByText('AI writing is on Plus and above').length).toBeGreaterThan(0);
  });

  it('leaves an ASK denial on the allowance copy — a D4 code is not a writing code', () => {
    registerTarget({}, 'piece-1');
    useAskBookStore.setState({ status: 'error', errorCode: 'ENTITLEMENT_DENIED' });
    renderPanel();

    fireEvent.click(screen.getByRole('tab', { name: 'Ask' }));
    expect(screen.getAllByText('This needs a paid plan').length).toBeGreaterThan(0);
    expect(screen.queryByText('AI writing is on Plus and above')).not.toBeInTheDocument();
  });
});
