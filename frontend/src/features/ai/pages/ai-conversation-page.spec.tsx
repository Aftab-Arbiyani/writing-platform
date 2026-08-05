import type { AiConversationDetail } from '@qalam/api-types';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/test/render';

import { aiApi } from '../api/ai.api';
import { AiConversationPage } from './ai-conversation-page';

vi.mock('../api/ai.api');

// The page reads its id from the route, so the router has to supply one.
vi.mock('react-router', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('react-router');
  return { ...actual, useParams: () => ({ conversationId: 'c1' }) };
});

const getConversation = vi.mocked(aiApi.getConversation);
const exportConversation = vi.mocked(aiApi.exportConversation);

function detail(over: Partial<AiConversationDetail> = {}): AiConversationDetail {
  return {
    id: 'c1',
    title: 'Rain over the city',
    feature: 'writing_assistant',
    status: 'active',
    messageCount: 2,
    createdAt: '2026-08-01T10:00:00.000Z',
    updatedAt: '2026-08-02T11:30:00.000Z',
    messages: [
      {
        id: 'm1',
        role: 'user',
        content: 'Tighten this opening.',
        // null on user/system messages by design (`ai.mappers.ts:16-23`).
        usage: null,
        createdAt: '2026-08-01T10:00:00.000Z',
      },
      {
        id: 'm2',
        role: 'assistant',
        content: 'Here is a tighter opening.',
        usage: { inputTokens: 120, outputTokens: 292, totalTokens: 412 },
        createdAt: '2026-08-01T10:00:04.000Z',
      },
    ],
    ...over,
  };
}

describe('AiConversationPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getConversation.mockResolvedValue(detail() as never);
  });

  it('renders the history in order with role labels', async () => {
    renderWithProviders(<AiConversationPage />);
    const messages = await screen.findByRole('list', { name: 'Messages' });
    const items = [...messages.querySelectorAll('li')];
    expect(items).toHaveLength(2);
    // An ordered list, and server order preserved: `listMessages` orders by createdAt ASC then id
    // (`conversation.repository.ts:45-50`), so a reversed render would misattribute the exchange.
    expect(messages.tagName).toBe('OL');
    expect(items[0]?.textContent).toContain('You');
    expect(items[1]?.textContent).toContain('Assistant');
  });

  it('shows token usage on the assistant message only', async () => {
    renderWithProviders(<AiConversationPage />);
    await screen.findByRole('list', { name: 'Messages' });
    // Absence, not a missing value: user/system messages carry no usage, so there is no placeholder
    // to render for them.
    expect(screen.getByText('412 tokens')).toBeInTheDocument();
    expect(screen.queryAllByText(/tokens$/)).toHaveLength(1);
  });

  it('renders message content as text, not markup', async () => {
    getConversation.mockResolvedValue(
      detail({
        messages: [
          {
            id: 'm1',
            role: 'assistant',
            content: '<em>not italic</em>',
            usage: null,
            createdAt: '2026-08-01T10:00:00.000Z',
          },
        ],
      }) as never,
    );
    renderWithProviders(<AiConversationPage />);
    // Stored content is whatever the provider returned. Rendering it as markup would let model
    // output decide this page's DOM.
    expect(await screen.findByText('<em>not italic</em>')).toBeInTheDocument();
  });

  it('falls back to the untitled placeholder', async () => {
    getConversation.mockResolvedValue(detail({ title: null }) as never);
    renderWithProviders(<AiConversationPage />);
    expect(
      await screen.findByRole('heading', { name: 'Untitled conversation' }),
    ).toBeInTheDocument();
  });

  it('explains an empty conversation instead of showing a bare page', async () => {
    getConversation.mockResolvedValue(detail({ messages: [], messageCount: 0 }) as never);
    renderWithProviders(<AiConversationPage />);
    expect(await screen.findByText('No messages yet')).toBeInTheDocument();
  });

  it('reports a not-found id rather than rendering an empty conversation', async () => {
    // A foreign or missing id both read as AI_CONVERSATION_NOT_FOUND — the server does not
    // distinguish them (`conversation.service.ts:65-71`), so one honest error state is correct.
    getConversation.mockRejectedValue(new Error('AI_CONVERSATION_NOT_FOUND'));
    renderWithProviders(<AiConversationPage />);
    expect(await screen.findByRole('status')).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Messages' })).toBeNull();
  });

  it('exports from the detail view too', async () => {
    exportConversation.mockResolvedValue({ ...detail(), messages: [] } as never);
    const createObjectURL = vi.fn(() => 'blob:x');
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL: vi.fn() });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    renderWithProviders(<AiConversationPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Export JSON' }));

    await waitFor(() => expect(exportConversation).toHaveBeenCalledWith('c1'));
    await waitFor(() => expect(click).toHaveBeenCalled());

    click.mockRestore();
    vi.unstubAllGlobals();
  });

  it('links back to the list', async () => {
    // A detail view with no way back is a dead end on a settings sub-route, where there is no
    // in-page nav to fall back on.
    renderWithProviders(<AiConversationPage />);
    const back = await screen.findByRole('link', { name: 'All conversations' });
    expect(back).toHaveAttribute('href', '/settings/ai/conversations');
  });

  it('offers no message composer — the assistant lives in the editor', async () => {
    renderWithProviders(<AiConversationPage />);
    await screen.findByRole('list', { name: 'Messages' });
    // Mobile can continue a conversation here; web deliberately cannot. A chat box on a settings page
    // would be an assistant with no manuscript in front of it.
    expect(screen.queryByRole('textbox')).toBeNull();
  });
});
