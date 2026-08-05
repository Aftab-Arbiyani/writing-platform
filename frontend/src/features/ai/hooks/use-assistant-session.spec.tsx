import type { ReactElement } from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useAiEditorTarget } from '@/stores/ai-editor-target.store';
import { renderWithProviders } from '@/test/render';

import { ASSISTANT_CONVERSATION_PARAM } from './use-assistant-conversation';
import { useAssistantSession } from './use-assistant-session';

const start = vi.fn<(payload: Record<string, unknown>) => Promise<void>>();

vi.mock('./use-ai-completion', () => ({
  useAiStream: () => ({ start, cancel: vi.fn() }),
  useAiCompletion: () => ({}),
}));

function Probe(): ReactElement {
  const { run } = useAssistantSession();
  return (
    <button type="button" onClick={() => void run({ kind: 'freeform' }, 'Tighten this.')}>
      run
    </button>
  );
}

/**
 * The one assertion that separates a conversations surface that fills from one that cannot: a
 * completion is persisted **only** when it carries a `conversationId`
 * (`ai-completion.service.ts:338`). Mobile never sends one, which is why its list is permanently
 * empty (docs/48 §3.12, W8-1) — these pin that web does when, and only when, the writer opted in.
 */
describe('useAssistantSession conversation binding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    start.mockResolvedValue();
    useAiEditorTarget.setState({
      target: {
        getContext: () => ({
          title: 'Draft',
          language: 'en',
          wordCount: 12,
          documentText: 'Some prose to work on.',
          selectionText: '',
        }),
        apply: () => true,
      },
    } as never);
  });

  it('omits conversationId entirely when the writer has not opted in', async () => {
    renderWithProviders(<Probe />, { route: '/write' });
    fireEvent.click(screen.getByRole('button', { name: 'run' }));

    await waitFor(() => expect(start).toHaveBeenCalled());
    const payload = start.mock.calls[0]?.[0] ?? {};
    // Absent, not `undefined`: the global pipe runs `forbidNonWhitelisted`, and an explicit
    // `conversationId: undefined` would serialize away anyway — but "no key" is the honest wire.
    expect(payload).not.toHaveProperty('conversationId');
  });

  it('sends the bound conversationId so the turn is persisted', async () => {
    renderWithProviders(<Probe />, {
      route: `/write?${ASSISTANT_CONVERSATION_PARAM}=conv-7`,
    });
    fireEvent.click(screen.getByRole('button', { name: 'run' }));

    await waitFor(() => expect(start).toHaveBeenCalled());
    expect(start.mock.calls[0]?.[0]).toMatchObject({ conversationId: 'conv-7' });
  });

  it('still sends the feature and the writer instruction alongside it', async () => {
    renderWithProviders(<Probe />, {
      route: `/write?${ASSISTANT_CONVERSATION_PARAM}=conv-7`,
    });
    fireEvent.click(screen.getByRole('button', { name: 'run' }));

    await waitFor(() => expect(start).toHaveBeenCalled());
    // Binding must not disturb what W2 already sends — the conversation is an addition, not a
    // replacement for the prompt/context payload.
    expect(start.mock.calls[0]?.[0]).toMatchObject({
      feature: 'writing_assistant',
      messages: [{ role: 'user', content: 'Tighten this.' }],
    });
  });
});
