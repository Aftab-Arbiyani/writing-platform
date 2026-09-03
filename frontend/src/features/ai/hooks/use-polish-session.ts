import { AiFeature } from '@qalam/shared';
import { useCallback } from 'react';

import {
  operandOf,
  useAiEditorTarget,
  type AiSuggestionPlacement,
  type AiWritingContext,
} from '@/stores/ai-editor-target.store';

import { useAiStreamStore } from '../stores/ai-stream.store';
import {
  defaultPlacement,
  promptKeyOf,
  promptVariablesOf,
  type WritingAction,
} from '../lib/writing-actions';
import { useAiStream } from './use-ai-completion';

/**
 * One Polish turn (D5, was the Writing Assistant) — take an action, stream a suggestion, apply or
 * discard it.
 *
 * The **editor owns the document**: this hook reads context from the registered
 * [`AiEditorTarget`](../../../stores/ai-editor-target.store.ts) and hands accepted text back to
 * it, so applying a suggestion is an ordinary editor command that autosave and undo already
 * understand. Nothing here touches TipTap.
 *
 * Streaming state lives in the AF1 `ai-stream.store` (transient UI state, docs/12) — this hook
 * adds only the semantics on top: which action produced the text, and where it should land.
 *
 * **Stateless since D5.** It used to bind an optional `conversationId` so a writer could opt into
 * keeping a server-side transcript; the conversation layer is deleted (B2) and the field is pinned
 * null server-side. Every turn is now a single request that stores no draft text anywhere — which
 * is the disclosure this tool makes, so it had better be true.
 */
export function usePolishSession() {
  const { start, cancel } = useAiStream();
  const target = useAiEditorTarget((s) => s.target);
  const reset = useAiStreamStore((s) => s.reset);

  /** The live context, read at call time — never cached, the writer keeps typing. */
  const readContext = useCallback(
    (): AiWritingContext | null => target?.getContext() ?? null,
    [target],
  );

  /**
   * Run an action. The operand — the selection, else the whole draft — is the message, and the
   * server template does the instructing.
   *
   * The freeform branch is gone with D5's "Ask AI" box: there is no longer a shape where the
   * writer's own instruction is the message and their prose is mere context. Every action now
   * operates ON the writer's text, so an empty operand means there is nothing to do.
   */
  const run = useCallback(
    async (action: WritingAction): Promise<void> => {
      const context = readContext();
      if (!context) return;

      const operand = operandOf(context);
      if (operand === '') return;

      await start({
        feature: AiFeature.WritingAssistant,
        promptKey: promptKeyOf(action),
        promptVariables: promptVariablesOf(action),
        messages: [{ role: 'user', content: operand }],
        context: [
          {
            type: 'writing_metadata',
            params: {
              title: context.title,
              language: context.language,
              wordCount: context.wordCount,
            },
          },
        ],
      });
    },
    [readContext, start],
  );

  /**
   * Apply the streamed suggestion. Returns false when the placement could not be honoured, so
   * the caller can say so rather than silently doing nothing.
   */
  const apply = useCallback(
    (text: string, placement: AiSuggestionPlacement): boolean => {
      if (!target || text.trim() === '') return false;
      const applied = target.apply(text, placement);
      if (applied) reset();
      return applied;
    },
    [target, reset],
  );

  /** Where a one-click Accept would put this action's output, given the live selection. */
  const placementFor = useCallback(
    (action: WritingAction): AiSuggestionPlacement => {
      const context = readContext();
      return defaultPlacement(action, context ? context.selectionText.trim() !== '' : false);
    },
    [readContext],
  );

  return { run, cancel, apply, placementFor, readContext, reset };
}
