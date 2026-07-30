import { AiFeature } from '@qalam/shared';
import type { AiFeaturesResponse, AiUsageResponse } from '@qalam/api-types';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useAiEditorTarget, type AiEditorTarget } from '@/stores/ai-editor-target.store';
import { renderWithProviders } from '@/test/render';

import { useAiFeatures, useAiUsage } from '../hooks/use-ai-meta';
import { useAiStreamStore } from '../stores/ai-stream.store';
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

function registerTarget(over: Partial<ReturnType<AiEditorTarget['getContext']>> = {}): void {
  useAiEditorTarget.setState({
    open: true,
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
    useAiEditorTarget.setState({ target: null, open: false });
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
});
