import { QButton, QSelect, useToast } from '@qalam/ui';
import { Check, RefreshCw, Square, X } from 'lucide-react';
import { useState, type ReactElement } from 'react';

import { AllowanceHint } from '@/components/allowance-hint';
import type { AiSuggestionPlacement } from '@/stores/ai-editor-target.store';

import {
  IMPROVE_ASPECTS,
  labelOf,
  ONE_CLICK_ACTIONS,
  type ImproveAspect,
  type WritingAction,
} from '../lib/writing-actions';
import { useAiStreamStore } from '../stores/ai-stream.store';
import { usePolishSession } from '../hooks/use-polish-session';
import { ModelDisclosureNote } from './model-disclosure-note';

const PLACEMENT_LABELS: Record<AiSuggestionPlacement, string> = {
  'replace-selection': 'Replace selection',
  'insert-below': 'Insert below',
  append: 'Append to end',
};

/**
 * Polish (D5, was the Writing Assistant tab) — tighten a passage the writer already wrote.
 *
 * **What left, and why the shape changed with it.** The old tab had five generation actions
 * (continue / rewrite / expand / tone) and a free-form "Ask AI" box; all of them are gone. The three
 * that remain — improve, simplify, condense — transform the writer's own sentences rather than
 * producing new ones, which is the line this audience actually draws. A tool that tightens a
 * paragraph is not the same product as one that writes the next paragraph, and the old panel sold
 * both under one name.
 *
 * That removed the tab's only text input, so the layout is now three buttons and an aspect select
 * rather than a composer. Simplify and Condense are explicit buttons instead of entries in a
 * quick-action loop, because with two of them a loop is indirection, not economy.
 *
 * **The suggestion is never applied automatically.** It renders in the panel and only reaches the
 * document when the writer accepts it, with the placement shown before they commit. A transform with
 * nothing selected inserts below rather than replacing the whole draft — this must not be able to
 * destroy a chapter with one click.
 */
export function PolishTab({ disabled }: { disabled: boolean }): ReactElement {
  const toast = useToast();
  const { run, cancel, apply, placementFor, readContext, reset } = usePolishSession();

  const status = useAiStreamStore((s) => s.status);
  const text = useAiStreamStore((s) => s.text);

  const [aspect, setAspect] = useState<ImproveAspect>('flow');
  const [lastAction, setLastAction] = useState<WritingAction | null>(null);

  const streaming = status === 'streaming';
  const busy = streaming || disabled;
  const hasSuggestion = text.trim() !== '' && !streaming;

  const context = readContext();
  const selectionPresent = (context?.selectionText ?? '').trim() !== '';
  const nothingToWorkWith = (context?.documentText ?? '').trim() === '';

  const start = (action: WritingAction): void => {
    setLastAction(action);
    void run(action);
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

      <div className="flex flex-wrap gap-2">
        {ONE_CLICK_ACTIONS.map((kind) => (
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

      <AllowanceHint featureKey="polishActionsPerDay" />

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
            aria-label="Suggestion"
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
                    start(lastAction);
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

      <ModelDisclosureNote />
    </div>
  );
}
