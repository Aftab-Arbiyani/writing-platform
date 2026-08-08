import { AiFeature } from '@qalam/shared';
import type { AiFeaturesResponse, AiUsageResponse } from '@qalam/api-types';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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
    renderWithProviders(<WritingAssistantPanel />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('offers the quick actions once an editor is registered', () => {
    registerTarget();
    renderWithProviders(<WritingAssistantPanel />);
    expect(screen.getByRole('button', { name: 'Continue writing' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rewrite' })).toBeInTheDocument();
  });

  it('sends the action’s prompt key and the document as the operand', async () => {
    registerTarget();
    renderWithProviders(<WritingAssistantPanel />);

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
    renderWithProviders(<WritingAssistantPanel />);
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
    renderWithProviders(<WritingAssistantPanel />);

    expect(screen.getByText('You’ve used your AI allowance')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Rewrite' })).not.toBeInTheDocument();
  });

  it('walls off the surface when the feature flag is down', () => {
    mockMeta(
      {
        aiEnabled: true,
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
    renderWithProviders(<WritingAssistantPanel />);
    expect(screen.getByText('Not available yet')).toBeInTheDocument();
  });

  it('walls off the surface when a request comes back over quota mid-flight', () => {
    registerTarget();
    useAiStreamStore.setState({ status: 'error', errorCode: 'QUOTA_EXCEEDED' });
    renderWithProviders(<WritingAssistantPanel />);
    expect(screen.getByText('You’ve used your AI allowance')).toBeInTheDocument();
  });

  it('applies an accepted suggestion through the editor target, never directly', () => {
    registerTarget();
    useAiStreamStore.setState({ status: 'done', text: 'A suggested line.' });
    renderWithProviders(<WritingAssistantPanel />);

    // No selection, so a one-click accept inserts below rather than replacing the draft.
    fireEvent.click(screen.getByRole('button', { name: /Insert below/ }));
    expect(apply).toHaveBeenCalledWith('A suggested line.', 'insert-below');
  });

  it('discards a suggestion without touching the document', () => {
    registerTarget();
    useAiStreamStore.setState({ status: 'done', text: 'A suggested line.' });
    renderWithProviders(<WritingAssistantPanel />);

    fireEvent.click(screen.getByRole('button', { name: /Discard/ }));
    expect(apply).not.toHaveBeenCalled();
    expect(useAiStreamStore.getState().text).toBe('');
  });

  it('exposes the Craft Coach as its own tab', () => {
    registerTarget();
    renderWithProviders(<WritingAssistantPanel />);
    expect(screen.getByRole('tab', { name: 'Craft Coach' })).toBeInTheDocument();
  });

  /**
   * W9's two story-scoped surfaces. Both take the SERVER piece id and are owner-scoped server-side,
   * so a draft that has never synced has no story to explore — the web reading of mobile's
   * `st.draft.isRemote` gate (`editor_screen.dart:245`).
   */
  it('hides the Explorer until the draft has a server id', () => {
    registerTarget({}, null);
    renderWithProviders(<WritingAssistantPanel />);
    expect(screen.queryByRole('tab', { name: 'Explorer' })).not.toBeInTheDocument();
  });

  it('offers the Explorer once the draft has synced', () => {
    registerTarget({}, 'piece-1');
    renderWithProviders(<WritingAssistantPanel />);
    expect(screen.getByRole('tab', { name: 'Explorer' })).toBeInTheDocument();
  });

  /**
   * The explorer's route carries `ai.use` and no feature flag, and makes no model call. Gating it on
   * a neighbouring flag would hide a surface the server would have served — the mistake mobile's
   * editor calls out by name at `editor_screen.dart:241-244`.
   */
  it('offers the Explorer even when every AI feature flag is down', () => {
    mockMeta({ aiEnabled: true, features: [] }, USAGE);
    registerTarget({}, 'piece-1');
    renderWithProviders(<WritingAssistantPanel />);
    expect(screen.getByRole('tab', { name: 'Explorer' })).toBeInTheDocument();
  });

  /** It spends no tokens, so a spent allowance is not a reason to lock a writer out of it. */
  it('offers the Explorer even when the allowance is spent', () => {
    mockMeta(FEATURES, {
      daily: { ...WINDOW, usedFraction: 1 },
      monthly: WINDOW,
    } as AiUsageResponse);
    registerTarget({}, 'piece-1');
    renderWithProviders(<WritingAssistantPanel />);
    expect(screen.getByRole('tab', { name: 'Explorer' })).toBeInTheDocument();
  });

  it('walls off the Explorer when AI is off entirely', () => {
    mockMeta({ aiEnabled: false, features: [] }, USAGE);
    registerTarget({}, 'piece-1');
    renderWithProviders(<WritingAssistantPanel />);

    fireEvent.click(screen.getByRole('tab', { name: 'Explorer' }));
    expect(screen.getAllByText('AI is turned off').length).toBeGreaterThan(0);
  });

  it('hides Ask until the draft has a server id, then offers it', () => {
    registerTarget({}, null);
    const { unmount } = renderWithProviders(<WritingAssistantPanel />);
    expect(screen.queryByRole('tab', { name: 'Ask' })).not.toBeInTheDocument();
    unmount();

    registerTarget({}, 'piece-1');
    renderWithProviders(<WritingAssistantPanel />);
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
        features: [
          { feature: AiFeature.AskBook, flagKey: 'feature.ai.askBook.enabled', enabled: false },
        ],
      },
      USAGE,
    );
    registerTarget({}, 'piece-1');
    renderWithProviders(<WritingAssistantPanel />);

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
    renderWithProviders(<WritingAssistantPanel />);

    // The assistant is walled…
    expect(screen.getByText('You’ve used your AI allowance')).toBeInTheDocument();
    // …and Ask still offers its controls, because its own stream has not failed.
    fireEvent.click(screen.getByRole('tab', { name: 'Ask' }));
    expect(screen.getByRole('button', { name: 'Whole book' })).toBeInTheDocument();
  });

  it('walls off Ask when ITS stream comes back over quota', () => {
    registerTarget({}, 'piece-1');
    useAskBookStore.setState({ status: 'error', errorCode: 'ENTITLEMENT_DENIED' });
    renderWithProviders(<WritingAssistantPanel />);

    fireEvent.click(screen.getByRole('tab', { name: 'Ask' }));
    expect(screen.getAllByText('This needs a paid plan').length).toBeGreaterThan(0);
  });
});
