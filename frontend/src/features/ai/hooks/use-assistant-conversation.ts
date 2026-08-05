import { useCallback } from 'react';
import { useSearchParams } from 'react-router';
import { AiFeature } from '@qalam/shared';

import { useCreateConversation } from './use-ai-conversations';

/** The editor URL parameter that binds the assistant to a conversation. */
export const ASSISTANT_CONVERSATION_PARAM = 'conversation';

/**
 * The conversation the in-editor assistant writes its turns into (W8).
 *
 * **Why this exists at all.** `AiCompletionRequestDto` takes an optional `conversationId`, and the
 * orchestrator persists a turn *only* when it was given one — `persist()` returns early otherwise
 * (`ai-completion.service.ts:338`). Nothing on either client ever supplied one, which is the root of
 * docs/48 §3.12 W8-1: mobile ships a conversations screen that can never fill. Web had the same
 * shape, so W8's conversations list would have filled with permanently empty rows — a surface built
 * on data that could not arrive. Binding the assistant is what makes the list mean something.
 *
 * **Why the URL and not a store.** Everything a URL can carry stays in the URL (docs/12 §3). The
 * binding survives a reload, is restorable from history, and lets a conversation deep-link straight
 * into the editor — which is what "Continue in the editor" on the detail page does. A store would
 * make the same session unrecoverable after a refresh.
 *
 * Opt-in, deliberately. Persisting every assistant turn by default would silently accumulate a
 * transcript of a writer's drafts server-side; keeping history is their choice.
 */
export function useAssistantConversation() {
  const [params, setParams] = useSearchParams();
  const create = useCreateConversation();

  const conversationId = params.get(ASSISTANT_CONVERSATION_PARAM);

  const bind = useCallback(
    (id: string): void => {
      const next = new URLSearchParams(params);
      next.set(ASSISTANT_CONVERSATION_PARAM, id);
      // `replace` so binding does not put a back-button step between the writer and their draft.
      setParams(next, { replace: true });
    },
    [params, setParams],
  );

  const unbind = useCallback((): void => {
    const next = new URLSearchParams(params);
    next.delete(ASSISTANT_CONVERSATION_PARAM);
    setParams(next, { replace: true });
  }, [params, setParams]);

  /**
   * Create a conversation and bind to it, so subsequent turns are kept. Returns its id, or null when
   * creation failed — the caller reports that rather than pretending history is on.
   */
  const startKeeping = useCallback(async (): Promise<string | null> => {
    try {
      const conversation = await create.mutateAsync({ feature: AiFeature.WritingAssistant });
      bind(conversation.id);
      return conversation.id;
    } catch {
      return null;
    }
  }, [create, bind]);

  return {
    conversationId,
    isKeeping: conversationId !== null,
    isStarting: create.isPending,
    bind,
    unbind,
    startKeeping,
  };
}
