import { QButton, QSelect, QTextArea, useToast } from '@qalam/ui';
import { Check, History, RefreshCw, Send, Square, X } from 'lucide-react';
import { useEffect, useState, type ReactElement } from 'react';
import { Link } from 'react-router';

import type { AiSuggestionPlacement } from '@/stores/ai-editor-target.store';
import { aiConversationPath } from '@/lib/routes';

import {
  IMPROVE_ASPECTS,
  labelOf,
  QUICK_ACTIONS,
  WRITING_TONES,
  type ImproveAspect,
  type WritingAction,
  type WritingTone,
} from '../lib/writing-actions';
import { useAiStreamStore } from '../stores/ai-stream.store';
import { usePromptLibraryStore } from '../stores/prompt-library.store';
import { useAssistantConversation } from '../hooks/use-assistant-conversation';
import { useAssistantSession } from '../hooks/use-assistant-session';

const PLACEMENT_LABELS: Record<AiSuggestionPlacement, string> = {
  'replace-selection': 'Replace selection',
  'insert-below': 'Insert below',
  append: 'Append to end',
};

/**
 * The Writing Assistant tab (W2/AF2) — quick actions, a free-form instruction, the streaming
 * suggestion, and accept/reject.
 *
 * **The suggestion is never applied automatically.** It renders in the panel and only reaches
 * the document when the writer accepts it, with the placement shown before they commit. A
 * transform with nothing selected inserts below rather than replacing the whole draft — the
 * assistant must not be able to destroy a chapter with one click.
 */
export function AssistantTab({ disabled }: { disabled: boolean }): ReactElement {
  const toast = useToast();
  const { run, cancel, apply, placementFor, readContext, reset } = useAssistantSession();

  const status = useAiStreamStore((s) => s.status);
  const text = useAiStreamStore((s) => s.text);

  const [instruction, setInstruction] = useState('');
  const [aspect, setAspect] = useState<ImproveAspect>('flow');
  const [tone, setTone] = useState<WritingTone>('formal');
  const [lastAction, setLastAction] = useState<WritingAction | null>(null);

  const takePendingInstruction = usePromptLibraryStore((s) => s.takePendingInstruction);

  /**
   * Pick up a preset the Prompt Library handed over (W8 C2) — "Use in assistant" stashes the
   * instruction and navigates here. Consumed once and cleared, so a later visit starts blank rather
   * than resurrecting a prompt chosen for a different draft. It fills the box rather than sending:
   * the writer still edits and chooses when to run it.
   */
  useEffect(() => {
    const pending = takePendingInstruction();
    if (pending !== null) setInstruction(pending);
  }, [takePendingInstruction]);

  const streaming = status === 'streaming';
  const busy = streaming || disabled;
  const hasSuggestion = text.trim() !== '' && !streaming;

  const context = readContext();
  const selectionPresent = (context?.selectionText ?? '').trim() !== '';
  const nothingToWorkWith = (context?.documentText ?? '').trim() === '';

  const start = (action: WritingAction, freeformInstruction?: string): void => {
    setLastAction(action);
    void run(action, freeformInstruction);
  };

  const accept = (placement: AiSuggestionPlacement): void => {
    if (apply(text, placement)) {
      toast.success('Added to your draft');
      setLastAction(null);
      return;
    }
    toast.error('Couldn’t apply that', {
      description:
        placement === 'replace-selection'
          ? 'Select some text first, or insert it below instead.'
          : 'The editor isn’t ready.',
    });
  };

  const defaultPlacement = lastAction ? placementFor(lastAction) : 'insert-below';

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-ink-secondary">
        {selectionPresent
          ? 'Working on your selection.'
          : 'Nothing selected — working on the whole draft.'}
      </p>

      <KeepHistoryRow />

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-ink">Quick actions</span>
        <div className="flex flex-wrap gap-2">
          {QUICK_ACTIONS.map((kind) => (
            <QButton
              key={kind}
              size="sm"
              variant="secondary"
              disabled={busy || nothingToWorkWith}
              onClick={() => {
                start({ kind });
              }}
            >
              {labelOf({ kind })}
            </QButton>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[9rem] flex-1">
          <QSelect
            aria-label="Improve aspect"
            value={aspect}
            onChange={(value) => {
              if (typeof value === 'string') setAspect(value as ImproveAspect);
            }}
            options={IMPROVE_ASPECTS.map((a) => ({ value: a.value, label: a.label }))}
          />
        </div>
        <QButton
          size="sm"
          variant="secondary"
          disabled={busy || nothingToWorkWith}
          onClick={() => {
            start({ kind: 'improve', aspect });
          }}
        >
          Improve
        </QButton>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[9rem] flex-1">
          <QSelect
            aria-label="Target tone"
            value={tone}
            onChange={(value) => {
              if (typeof value === 'string') setTone(value as WritingTone);
            }}
            options={WRITING_TONES.map((t) => ({ value: t.value, label: t.label }))}
          />
        </div>
        <QButton
          size="sm"
          variant="secondary"
          disabled={busy || nothingToWorkWith}
          onClick={() => {
            start({ kind: 'tone', tone });
          }}
        >
          Set tone
        </QButton>
      </div>

      <div className="flex flex-col gap-2">
        <QTextArea
          label="Ask AI"
          rows={3}
          value={instruction}
          placeholder="Ask for anything — a line of dialogue, a tighter opening…"
          onChange={(event) => {
            setInstruction(event.target.value);
          }}
        />
        <QButton
          size="sm"
          variant="primary"
          icon={Send}
          disabled={busy || instruction.trim() === ''}
          onClick={() => {
            start({ kind: 'freeform' }, instruction.trim());
          }}
        >
          Send
        </QButton>
      </div>

      {streaming || text !== '' ? (
        <section className="flex flex-col gap-2 border-t border-line pt-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-ink">
              {lastAction ? labelOf(lastAction) : 'Suggestion'}
            </span>
            {streaming ? (
              <QButton size="sm" variant="ghost" icon={Square} onClick={cancel}>
                Stop
              </QButton>
            ) : null}
          </div>

          <div
            className="max-h-64 overflow-y-auto whitespace-pre-wrap rounded-md bg-raised p-3 text-sm text-ink"
            aria-live="polite"
            aria-busy={streaming}
            aria-label="AI suggestion"
          >
            {text === '' ? 'Thinking…' : text}
          </div>

          {hasSuggestion ? (
            <div className="flex flex-wrap gap-2">
              <QButton
                size="sm"
                variant="primary"
                icon={Check}
                onClick={() => {
                  accept(defaultPlacement);
                }}
              >
                {PLACEMENT_LABELS[defaultPlacement]}
              </QButton>
              {defaultPlacement === 'replace-selection' ? (
                <QButton
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    accept('insert-below');
                  }}
                >
                  Insert below
                </QButton>
              ) : null}
              {lastAction ? (
                <QButton
                  size="sm"
                  variant="ghost"
                  icon={RefreshCw}
                  onClick={() => {
                    start(lastAction, instruction.trim() || undefined);
                  }}
                >
                  Try again
                </QButton>
              ) : null}
              <QButton
                size="sm"
                variant="ghost"
                icon={X}
                onClick={() => {
                  reset();
                  setLastAction(null);
                }}
              >
                Discard
              </QButton>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

/**
 * The opt-in that makes this session survive it (W8).
 *
 * Without a bound conversation the server answers and stores nothing — `persist()` returns early when
 * no `conversationId` was sent (`ai-completion.service.ts:338`). That is why mobile's conversations
 * screen can never fill (docs/48 §3.12, W8-1), and why W8's conversations list needs this control to
 * be worth having: it is the only thing on either client that causes a conversation to gain messages.
 *
 * Opt-in rather than automatic: persisting every turn by default would quietly build a server-side
 * transcript of a writer's drafts.
 */
function KeepHistoryRow(): ReactElement {
  const toast = useToast();
  const { conversationId, isKeeping, isStarting, startKeeping, unbind } =
    useAssistantConversation();

  if (isKeeping && conversationId !== null) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-ink-muted text-xs">Keeping this session’s history.</span>
        <Link
          to={aiConversationPath(conversationId)}
          className="text-accent focus-visible:ring-accent rounded-md text-xs outline-none focus-visible:ring-2"
        >
          View conversation
        </Link>
        <QButton size="sm" variant="ghost" onClick={unbind}>
          Stop keeping
        </QButton>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-ink-muted text-xs">This session isn’t being saved.</span>
      <QButton
        size="sm"
        variant="ghost"
        icon={History}
        loading={isStarting}
        onClick={() => {
          void startKeeping().then((id) => {
            if (id === null) {
              toast.error('Couldn’t start keeping history');
            }
          });
        }}
      >
        Keep history
      </QButton>
    </div>
  );
}
