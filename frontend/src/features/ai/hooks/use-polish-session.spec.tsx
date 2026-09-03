import type { ReactElement } from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useAiEditorTarget } from '@/stores/ai-editor-target.store';
import { renderWithProviders } from '@/test/render';

import type { WritingAction } from '../lib/writing-actions';
import { usePolishSession } from './use-polish-session';

const start = vi.fn<(payload: Record<string, unknown>) => Promise<void>>();

vi.mock('./use-ai-completion', () => ({
  useAiStream: () => ({ start, cancel: vi.fn() }),
  useAiCompletion: () => ({}),
}));

function Probe({ action }: { action: WritingAction }): ReactElement {
  const { run } = usePolishSession();
  return (
    <button type="button" onClick={() => void run(action)}>
      run
    </button>
  );
}

function setEditor(over: { documentText?: string; selectionText?: string } = {}): void {
  useAiEditorTarget.setState({
    target: {
      getContext: () => ({
        title: 'Draft',
        language: 'en',
        wordCount: 12,
        documentText: 'Some prose to work on.',
        selectionText: '',
        ...over,
      }),
      apply: () => true,
    },
  } as never);
}

/**
 * What a Polish turn puts on the wire.
 *
 * **This file used to pin the opposite property.** Its whole subject was conversation binding: a
 * completion is persisted only when it carries a `conversationId`, so these asserted that web sent
 * one when the writer had opted into keeping history — the thing that made the conversations list
 * fill, and whose absence on mobile is why mobile's list never could (48 §3.12, W8-1).
 *
 * D5 deleted the conversation layer, so the assertion inverts: the request must carry no
 * conversation at all, and nothing a writer types here is stored server-side. That is not a detail —
 * it is the claim the disclosure note makes in every tool, and a spec is the only thing that keeps a
 * sentence in the UI true.
 */
describe('usePolishSession — what a turn sends', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    start.mockResolvedValue();
    setEditor();
  });

  it('sends no conversation, so the turn is stored nowhere', async () => {
    renderWithProviders(<Probe action={{ kind: 'simplify' }} />, { route: '/write' });
    fireEvent.click(screen.getByRole('button', { name: 'run' }));

    await waitFor(() => expect(start).toHaveBeenCalled());
    const payload = start.mock.calls[0]?.[0] ?? {};
    // Absent, not `undefined`: the global pipe runs `forbidNonWhitelisted`, so a key the DTO no
    // longer declares is a 400 on the whole request rather than a field that is quietly ignored.
    expect(payload).not.toHaveProperty('conversationId');
  });

  it('sends the operand as the message and the prompt key as the instruction', async () => {
    renderWithProviders(<Probe action={{ kind: 'condense' }} />, { route: '/write' });
    fireEvent.click(screen.getByRole('button', { name: 'run' }));

    await waitFor(() => expect(start).toHaveBeenCalled());
    expect(start.mock.calls[0]?.[0]).toMatchObject({
      feature: 'writing_assistant',
      promptKey: 'writing_assistant.condense',
      messages: [{ role: 'user', content: 'Some prose to work on.' }],
    });
  });

  it('sends the selection as the operand when there is one', async () => {
    setEditor({ selectionText: 'A single tight line.' });
    renderWithProviders(<Probe action={{ kind: 'simplify' }} />, { route: '/write' });
    fireEvent.click(screen.getByRole('button', { name: 'run' }));

    await waitFor(() => expect(start).toHaveBeenCalled());
    expect(start.mock.calls[0]?.[0]).toMatchObject({
      messages: [{ role: 'user', content: 'A single tight line.' }],
    });
  });

  it('sends the aspect as a prompt VARIABLE, never as prose in the message', async () => {
    renderWithProviders(<Probe action={{ kind: 'improve', aspect: 'clarity' }} />, {
      route: '/write',
    });
    fireEvent.click(screen.getByRole('button', { name: 'run' }));

    await waitFor(() => expect(start).toHaveBeenCalled());
    // The template body lives on the server and is versioned there. A client that phrased the
    // instruction itself would fork the prompt from the one the server renders.
    expect(start.mock.calls[0]?.[0]).toMatchObject({
      promptKey: 'writing_assistant.improve',
      promptVariables: { aspect: 'clarity' },
    });
  });

  it('sends the draft’s metadata as context, and nothing else', async () => {
    renderWithProviders(<Probe action={{ kind: 'simplify' }} />, { route: '/write' });
    fireEvent.click(screen.getByRole('button', { name: 'run' }));

    await waitFor(() => expect(start).toHaveBeenCalled());
    expect(start.mock.calls[0]?.[0]).toMatchObject({
      context: [
        { type: 'writing_metadata', params: { title: 'Draft', language: 'en', wordCount: 12 } },
      ],
    });
  });

  it('asks for nothing when there is nothing to work on', async () => {
    // Every remaining action transforms an operand, so an empty draft has no request to make. The
    // old freeform action was the exception — it sent the writer's instruction with no operand at
    // all — and removing it is what makes this an unconditional guard.
    setEditor({ documentText: '   ' });
    renderWithProviders(<Probe action={{ kind: 'condense' }} />, { route: '/write' });
    fireEvent.click(screen.getByRole('button', { name: 'run' }));

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(start).not.toHaveBeenCalled();
  });
});
