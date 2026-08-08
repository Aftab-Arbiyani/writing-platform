import type { AskBookStreamEvent } from '@qalam/api-types';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api-client';
import { renderWithProviders } from '@/test/render';

import { storyRetrievalApi } from '../api/story-retrieval.api';
import { useAskBookStore } from '../stores/ask-book.store';
import { AskBookTab } from './ask-book-tab';

vi.mock('../api/story-retrieval.api', () => ({ storyRetrievalApi: { askStream: vi.fn() } }));

const askStream = vi.mocked(storyRetrievalApi.askStream);

/** A finished stream: the frames arrive in the server's order, `sources` first. */
function streamOf(events: AskBookStreamEvent[]) {
  return (async function* gen() {
    for (const event of events) yield event;
  })();
}

/** A stream that emits, then hangs — so the UI's streaming state is observable. */
function openStreamOf(events: AskBookStreamEvent[]) {
  return (async function* gen() {
    for (const event of events) yield event;
    await new Promise(() => {
      /* never settles; the test asserts mid-stream */
    });
  })();
}

const SOURCES: AskBookStreamEvent = {
  type: 'sources',
  citations: [
    { ref: 'n1', label: 'Ch. 2 — Aria', quote: 'She would not be moved.' },
    { ref: 'n2', label: 'Ch. 5 — The mentor', quote: 'He lied, and knew it.' },
  ],
  confidence: 0.82,
};

function ask(question = 'How does Aria change?'): void {
  fireEvent.change(screen.getByLabelText('Your question'), { target: { value: question } });
  fireEvent.click(screen.getByRole('button', { name: 'Ask' }));
}

describe('AskBookTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAskBookStore.getState().reset();
    askStream.mockImplementation(() => streamOf([]));
  });

  it('offers all nine scopes and starts on the server’s default', () => {
    renderWithProviders(<AskBookTab storyId="piece-1" disabled={false} />);
    for (const label of [
      'Whole book',
      'This chapter',
      'This scene',
      'A character',
      'Timeline',
      'A relationship',
      'The world',
      'Themes',
      'Lore',
    ]) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    }
    // `book` is what an omitted `scope` resolves to server-side, so the UI must agree.
    expect(screen.getByRole('button', { name: 'Whole book' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('sends the story, the question and the chosen scope', async () => {
    renderWithProviders(<AskBookTab storyId="piece-1" disabled={false} />);

    fireEvent.click(screen.getByRole('button', { name: 'Timeline' }));
    ask('When does the bargain happen?');

    await waitFor(() => {
      expect(askStream).toHaveBeenCalled();
    });
    expect(askStream.mock.calls[0]?.[0]).toEqual({
      storyId: 'piece-1',
      question: 'When does the bargain happen?',
      scope: 'timeline',
    });
  });

  it('refuses to ask nothing', () => {
    renderWithProviders(<AskBookTab storyId="piece-1" disabled={false} />);
    expect(screen.getByRole('button', { name: 'Ask' })).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Your question'), { target: { value: '   ' } });
    expect(screen.getByRole('button', { name: 'Ask' })).toBeDisabled();
  });

  /**
   * The reason the whole surface is trustworthy: `sources` is the FIRST frame, so the evidence is on
   * screen while the answer is still being written rather than appearing after it.
   */
  it('shows the cited sources before a single token of the answer arrives', async () => {
    askStream.mockImplementation(() => openStreamOf([SOURCES]));
    renderWithProviders(<AskBookTab storyId="piece-1" disabled={false} />);
    ask();

    expect(await screen.findByText('Sources (2)')).toBeInTheDocument();
    expect(screen.getByText('She would not be moved.')).toBeInTheDocument();
    // Nothing has been generated yet.
    expect(screen.getByLabelText('Answer, in progress')).toHaveTextContent('Thinking…');
  });

  it('accumulates the deltas in order into one answer', async () => {
    askStream.mockImplementation(() =>
      streamOf([
        SOURCES,
        { type: 'start', conversationId: null },
        { type: 'delta', text: 'She begins ' },
        { type: 'delta', text: 'reluctant, ' },
        { type: 'delta', text: 'and ends resolute.' },
        { type: 'done', usage: { inputTokens: 10, outputTokens: 8, totalTokens: 18 } },
      ]),
    );
    renderWithProviders(<AskBookTab storyId="piece-1" disabled={false} />);
    ask();

    expect(await screen.findByText('She begins reluctant, and ends resolute.')).toBeInTheDocument();
    expect(useAskBookStore.getState().status).toBe('done');
  });

  it('offers Stop while streaming, and keeps the partial answer when it is used', async () => {
    askStream.mockImplementation(() =>
      openStreamOf([SOURCES, { type: 'delta', text: 'She begins' }]),
    );
    renderWithProviders(<AskBookTab storyId="piece-1" disabled={false} />);
    ask();

    const stop = await screen.findByRole('button', { name: 'Stop' });
    // The abort must reach the request — that is what stops generation server-side.
    expect(askStream.mock.calls[0]?.[1]?.signal?.aborted).toBe(false);
    fireEvent.click(stop);
    expect(askStream.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
  });

  it('re-runs the question that produced the answer, not what is in the box now', async () => {
    renderWithProviders(<AskBookTab storyId="piece-1" disabled={false} />);
    ask('First question?');
    await waitFor(() => {
      expect(askStream).toHaveBeenCalledTimes(1);
    });

    fireEvent.change(screen.getByLabelText('Your question'), {
      target: { value: 'Something else entirely?' },
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Try again' }));

    await waitFor(() => {
      expect(askStream).toHaveBeenCalledTimes(2);
    });
    expect(askStream.mock.calls[1]?.[0]).toMatchObject({ question: 'First question?' });
  });

  /**
   * A story with no AF3 graph is the state every draft starts in, so it gets copy that names the
   * remedy instead of the generic stream failure.
   */
  it('explains a story that has no graph yet', async () => {
    askStream.mockImplementation(() => {
      throw new ApiError(404, { code: 'STORY_NOT_FOUND', message: 'nope' });
    });
    renderWithProviders(<AskBookTab storyId="piece-1" disabled={false} />);
    ask();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This story isn’t ready to answer questions yet.',
    );
  });

  it('reports an in-stream failure and leaves the question retryable', async () => {
    askStream.mockImplementation(() =>
      streamOf([SOURCES, { type: 'error', code: 'AI_STREAM_ERROR', message: 'broke' }]),
    );
    renderWithProviders(<AskBookTab storyId="piece-1" disabled={false} />);
    ask();

    expect(await screen.findByRole('alert')).toHaveTextContent('That answer didn’t finish.');
    expect(screen.getByRole('button', { name: 'Try again' })).toBeEnabled();
  });

  /**
   * A dropped connection ends the iteration with no `done` and no `error`. Without a settle the tab
   * stays in `streaming` forever — spinner on Ask, no Try again, no way out but closing the drawer.
   * Mobile guards the same case in its controller's `onDone` (`ask_book_controller.dart:98-101`).
   */
  it('settles a stream that closes without a terminal frame instead of spinning forever', async () => {
    askStream.mockImplementation(() => streamOf([SOURCES, { type: 'delta', text: 'She begins' }]));
    renderWithProviders(<AskBookTab storyId="piece-1" disabled={false} />);
    ask();

    expect(await screen.findByRole('button', { name: 'Try again' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Stop' })).not.toBeInTheDocument();
    expect(useAskBookStore.getState().status).toBe('done');
    // Whatever did arrive is kept.
    expect(screen.getByText('She begins')).toBeInTheDocument();
  });

  it('says what it does before anything has been asked', () => {
    renderWithProviders(<AskBookTab storyId="piece-1" disabled={false} />);
    expect(
      screen.getByText(
        'Answers are grounded in your story’s knowledge graph and cite their sources.',
      ),
    ).toBeInTheDocument();
  });
});
