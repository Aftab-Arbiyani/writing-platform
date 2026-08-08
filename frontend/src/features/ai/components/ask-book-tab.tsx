import { AskScope } from '@qalam/shared';
import { QButton, QTextArea, cn } from '@qalam/ui';
import { BookOpen, Quote, RefreshCw, Send, Square } from 'lucide-react';
import { useState, type ReactElement } from 'react';

import { ASK_SCOPES } from '../lib/ask-scopes';
import { useAskBook } from '../hooks/use-ask-book';
import { useAskBookStore } from '../stores/ask-book.store';

/**
 * The Ask My Book tab (W9/AF4) — grounded Q&A over one story's knowledge graph.
 *
 * Mobile's `ask_book_screen.dart` is the reference, part for part: scope chips, the question box,
 * Ask with a Stop beside it while streaming, the answer, and the sources it cites. Arranged for the
 * drawer rather than a full screen (docs/48 §4.1).
 *
 * **The sources are the point, and they render before the answer does.** The stream's first frame is
 * `sources`, so the evidence the answer will be built from is on screen while it is still being
 * written — an answer a writer can check, rather than one they must take on faith. Nothing here
 * composes a prompt or picks evidence; the server assembles context from the graph and the client
 * renders what came back.
 */
export function AskBookTab({
  storyId,
  disabled,
}: {
  storyId: string;
  disabled: boolean;
}): ReactElement {
  const { ask, cancel } = useAskBook();
  const [question, setQuestion] = useState('');
  const [scope, setScope] = useState<AskScope>(AskScope.Book);
  // The question that produced what is on screen — so "Try again" re-runs THAT, not whatever the
  // writer has since started typing in the box.
  const [asked, setAsked] = useState<{ question: string; scope: AskScope } | null>(null);

  const status = useAskBookStore((s) => s.status);
  const answer = useAskBookStore((s) => s.answer);
  const citations = useAskBookStore((s) => s.citations);
  const errorCode = useAskBookStore((s) => s.errorCode);

  const streaming = status === 'streaming';
  const trimmed = question.trim();

  const run = (payload: { question: string; scope: AskScope }): void => {
    setAsked(payload);
    void ask({ storyId, question: payload.question, scope: payload.scope });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-ink" id="ask-scope-label">
          Ask about
        </span>
        {/* A pressed-state button group rather than a radiogroup: these run inside an AntD tabpanel
            and, like the explorer's view chips, must not add a second roving-focus widget to a
            drawer that already has tabs. */}
        <div className="flex flex-wrap gap-1.5" role="group" aria-labelledby="ask-scope-label">
          {ASK_SCOPES.map((entry) => {
            const active = entry.scope === scope;
            return (
              <button
                key={entry.scope}
                type="button"
                aria-pressed={active}
                disabled={streaming}
                onClick={() => {
                  setScope(entry.scope);
                }}
                className={cn(
                  'focus-visible:outline-accent inline-flex min-h-10 items-center rounded-full border px-3.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60',
                  active
                    ? 'border-accent bg-accent/12 text-accent-on-tint'
                    : 'border-line bg-surface text-ink-secondary hover:border-ink-muted hover:text-ink',
                )}
              >
                {entry.label}
              </button>
            );
          })}
        </div>
      </div>

      <QTextArea
        label="Your question"
        rows={3}
        value={question}
        placeholder="e.g. How does Aria change by the end?"
        onChange={(event) => {
          setQuestion(event.target.value);
        }}
      />

      <div className="flex flex-wrap gap-2">
        <QButton
          variant="primary"
          size="sm"
          icon={Send}
          loading={streaming}
          disabled={disabled || streaming || trimmed === ''}
          onClick={() => {
            run({ question: trimmed, scope });
          }}
        >
          {streaming ? 'Answering…' : 'Ask'}
        </QButton>
        {streaming ? (
          <QButton variant="ghost" size="sm" icon={Square} onClick={cancel}>
            Stop
          </QButton>
        ) : null}
        {/* Retry belongs to a settled attempt, not to a failure: a stopped or thin answer is just as
            likely to be worth re-running as an errored one. */}
        {!streaming && asked !== null ? (
          <QButton
            variant="ghost"
            size="sm"
            icon={RefreshCw}
            disabled={disabled}
            onClick={() => {
              run(asked);
            }}
          >
            Try again
          </QButton>
        ) : null}
      </div>

      {status === 'idle' ? (
        <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-raised">
            <BookOpen size={24} strokeWidth={1.5} className="text-ink-muted" aria-hidden />
          </span>
          <p className="max-w-[40ch] text-sm text-ink-secondary">
            Answers are grounded in your story’s knowledge graph and cite their sources.
          </p>
        </div>
      ) : null}

      {/**
       * The blocked states (`AI_DISABLED`, `AI_FEATURE_DISABLED`, quota, entitlement) are handled a
       * level up, where they replace the whole tab with a notice and a remedy. What is left here is
       * the request-shaped failures — a story with no graph, a stream that broke mid-answer — which
       * are retried, not upgraded away.
       */}
      {status === 'error' ? (
        <p className="text-sm text-danger-text" role="alert">
          {errorCode === 'STORY_NOT_FOUND'
            ? 'This story isn’t ready to answer questions yet. Analyse it first to build its knowledge graph.'
            : 'That answer didn’t finish. Try asking again.'}
        </p>
      ) : null}

      {status === 'streaming' || (answer !== '' && status !== 'error') ? (
        <section className="flex flex-col gap-2 border-t border-line pt-3">
          <div
            dir="auto"
            className="whitespace-pre-wrap text-sm text-ink"
            aria-live="polite"
            aria-busy={streaming}
            aria-label={streaming ? 'Answer, in progress' : 'Answer'}
          >
            {answer === '' ? 'Thinking…' : answer}
          </div>
          {status === 'cancelled' && answer !== '' ? (
            <p className="text-xs text-ink-muted">Stopped — this answer is incomplete.</p>
          ) : null}
        </section>
      ) : null}

      {citations.length > 0 ? (
        <section className="flex flex-col gap-2 border-t border-line pt-3">
          <h4 className="text-sm font-medium text-ink">Sources ({citations.length})</h4>
          <ul className="flex flex-col gap-2">
            {citations.map((citation, index) => (
              <li
                key={`${citation.ref}:${String(index)}`}
                className="flex items-start gap-2 text-sm"
              >
                <Quote
                  size={13}
                  strokeWidth={1.75}
                  className="mt-1 shrink-0 text-ink-muted"
                  aria-hidden
                />
                <p dir="auto" className="min-w-0">
                  {citation.quote === '' ? null : (
                    <span className="text-ink-secondary italic">{citation.quote}</span>
                  )}
                  <span className="block text-ink-muted">{citation.label}</span>
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
