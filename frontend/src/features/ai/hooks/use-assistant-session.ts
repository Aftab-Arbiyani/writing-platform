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
  isContinuation,
  promptKeyOf,
  promptVariablesOf,
  type WritingAction,
} from '../lib/writing-actions';
import { useAiStream } from './use-ai-completion';
import { useAssistantConversation } from './use-assistant-conversation';

/**
 * One Writing Assistant turn (W2/AF2) — take an action, stream a suggestion, apply or discard it.
 *
 * The **editor owns the document**: this hook reads context from the registered
 * [`AiEditorTarget`](../../../stores/ai-editor-target.store.ts) and hands accepted text back to
 * it, so applying a suggestion is an ordinary editor command that autosave and undo already
 * understand. Nothing here touches TipTap.
 *
 * Streaming state lives in the AF1 `ai-stream.store` (transient UI state, docs/12) — this hook
 * adds only the AF2 semantics on top: which action produced the text, and where it should land.
 */
export function useAssistantSession() {
  const { start, cancel } = useAiStream();
  const target = useAiEditorTarget((s) => s.target);
  const reset = useAiStreamStore((s) => s.reset);
  const { conversationId } = useAssistantConversation();

  /** The live context, read at call time — never cached, the writer keeps typing. */
  const readContext = useCallback(
    (): AiWritingContext | null => target?.getContext() ?? null,
    [target],
  );

  /**
   * Run an action. Quick actions send the operand (selection, else the whole document) as the
   * message and let the server template do the instructing; free-form "Ask AI" sends the
   * writer's own instruction and attaches the selection as labelled context instead — the
   * distinction mobile draws, and the one the `writing_assistant.freeform` template expects.
   */
  const run = useCallback(
    async (action: WritingAction, instruction?: string): Promise<void> => {
      const context = readContext();
      if (!context) return;

      const operand = operandOf(context);
      const freeform = action.kind === 'freeform';
      if (!freeform && operand === '') return;

      const metadata = {
        type: 'writing_metadata',
        params: {
          title: context.title,
          language: context.language,
          wordCount: context.wordCount,
        },
      };

      await start({
        feature: AiFeature.WritingAssistant,
        // Only sent when the writer has opted into keeping history. Omitted, the server answers and
        // stores nothing (`ai-completion.service.ts:338`); present, it appends the user turn and the
        // reply to that conversation — which is the only way a conversation ever gains messages
        // (docs/48 §3.12, W8-1).
        ...(conversationId === null ? {} : { conversationId }),
        promptKey: promptKeyOf(action),
        promptVariables: promptVariablesOf(action),
        messages: [{ role: 'user', content: freeform ? (instruction ?? '') : operand }],
        context:
          freeform && context.selectionText.trim() !== ''
            ? [{ type: 'selection', params: { text: context.selectionText } }, metadata]
            : [metadata],
      });
    },
    [readContext, start, conversationId],
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

  return { run, cancel, apply, placementFor, readContext, reset, isContinuation };
}
