import { QButton, QSelect, QTextArea, useToast } from '@qalam/ui';
import { Check, RefreshCw, Send, Square, X } from 'lucide-react';
import { useState, type ReactElement } from 'react';

import type { AiSuggestionPlacement } from '@/stores/ai-editor-target.store';

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
