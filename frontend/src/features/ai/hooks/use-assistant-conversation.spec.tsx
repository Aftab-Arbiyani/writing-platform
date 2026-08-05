import { fireEvent, screen, waitFor } from '@testing-library/react';
import type { ReactElement } from 'react';
import { useSearchParams } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/test/render';

import { aiApi } from '../api/ai.api';
import {
  ASSISTANT_CONVERSATION_PARAM,
  useAssistantConversation,
} from './use-assistant-conversation';

vi.mock('../api/ai.api');

const createConversation = vi.mocked(aiApi.createConversation);

function Probe(): ReactElement {
  const { conversationId, isKeeping, startKeeping, unbind } = useAssistantConversation();
  // Read sibling params through the router, not `window.location` — the harness uses MemoryRouter,
  // which never touches the real URL.
  const [params] = useSearchParams();
  return (
    <div>
      <span data-testid="draft">{params.get('draft') ?? 'none'}</span>
      <span data-testid="bound">{conversationId ?? 'none'}</span>
      <span data-testid="keeping">{String(isKeeping)}</span>
      <button type="button" onClick={() => void startKeeping()}>
        keep
      </button>
      <button type="button" onClick={unbind}>
        stop
      </button>
    </div>
  );
}

/**
 * This binding is the difference between a conversations list that fills and one that cannot. The
 * orchestrator persists a turn only when a `conversationId` was sent (`ai-completion.service.ts:338`),
 * so these specs pin the mechanism that supplies it (docs/48 §3.12, W8-1).
 */
describe('useAssistantConversation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createConversation.mockResolvedValue({
      id: 'conv-1',
      title: null,
      feature: 'writing_assistant',
      status: 'active',
      messageCount: 0,
      createdAt: '2026-08-05T10:00:00.000Z',
      updatedAt: '2026-08-05T10:00:00.000Z',
    } as never);
  });

  it('reads no binding by default', () => {
    renderWithProviders(<Probe />, { route: '/write' });
    expect(screen.getByTestId('bound')).toHaveTextContent('none');
    expect(screen.getByTestId('keeping')).toHaveTextContent('false');
  });

  it('reads the binding out of the URL, so a reload keeps it', () => {
    // The reason this lives in the URL rather than a store: a refresh mid-session must not silently
    // stop persisting turns, and a conversation must be deep-linkable into the editor.
    renderWithProviders(<Probe />, {
      route: `/write?${ASSISTANT_CONVERSATION_PARAM}=conv-9`,
    });
    expect(screen.getByTestId('bound')).toHaveTextContent('conv-9');
    expect(screen.getByTestId('keeping')).toHaveTextContent('true');
  });

  it('creates a conversation on the writing_assistant feature and binds to it', async () => {
    renderWithProviders(<Probe />, { route: '/write' });
    fireEvent.click(screen.getByRole('button', { name: 'keep' }));

    await waitFor(() =>
      expect(createConversation).toHaveBeenCalledWith({ feature: 'writing_assistant' }),
    );
    await waitFor(() => expect(screen.getByTestId('bound')).toHaveTextContent('conv-1'));
  });

  it('stays unbound when creation fails, rather than claiming history is on', async () => {
    // Reporting "keeping history" over a failed POST would promise persistence that is not happening.
    createConversation.mockRejectedValue(new Error('boom'));
    renderWithProviders(<Probe />, { route: '/write' });
    fireEvent.click(screen.getByRole('button', { name: 'keep' }));

    await waitFor(() => expect(createConversation).toHaveBeenCalled());
    expect(screen.getByTestId('bound')).toHaveTextContent('none');
    expect(screen.getByTestId('keeping')).toHaveTextContent('false');
  });

  it('unbinds without dropping the rest of the query string', async () => {
    renderWithProviders(<Probe />, {
      route: `/write?draft=abc&${ASSISTANT_CONVERSATION_PARAM}=conv-9`,
    });
    fireEvent.click(screen.getByRole('button', { name: 'stop' }));

    await waitFor(() => expect(screen.getByTestId('bound')).toHaveTextContent('none'));
    // Clobbering sibling params would drop editor state that has nothing to do with AI.
    expect(screen.getByTestId('draft')).toHaveTextContent('abc');
  });
});
