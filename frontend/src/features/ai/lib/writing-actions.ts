import type { AiSuggestionPlacement } from '@/stores/ai-editor-target.store';

/**
 * Polish actions (D5, was the Writing Assistant) — the client vocabulary mapping each user action to
 * a **server** prompt-template key plus its declared variables.
 *
 * This file holds **no prompt text**. Bodies live only on the server, versioned
 * (`backend/src/modules/ai/prompts/prompt-catalog.ts`); hardcoding a prompt in the UI would fork
 * it from the version the server actually renders. Only identifiers and display copy live here.
 *
 * **D5 removed the five generation actions** — `continue`, `rewrite`, `expand`, `tone` and the
 * freeform "Ask AI" box — and their prompts are gone from the server catalogue (B2). What is left is
 * the three that transform the writer's own sentences into their own sentences: improve, simplify,
 * condense. That is the whole distinction the decision turns on. This audience does not object to a
 * tool that tightens a paragraph they wrote; they object to one that writes the next one.
 *
 * All three remain the single `writing_assistant` AI feature — one flag, one premium code, one
 * allowance. The specific action is a prompt key, never a distinct feature. `writing_assistant` is
 * Polish's internal id and stays on the wire (D5 decision 10: rename what the writer reads, not the
 * contract).
 */

export type PolishActionKind = 'improve' | 'simplify' | 'condense';

/** The aspect an "Improve" targets. The phrase is sent as the `{{aspect}}` template variable. */
export const IMPROVE_ASPECTS = [
  { value: 'flow', label: 'Flow', phrase: 'flow and rhythm' },
  { value: 'clarity', label: 'Clarity', phrase: 'clarity' },
  { value: 'grammar', label: 'Grammar', phrase: 'grammar and correctness' },
  { value: 'style', label: 'Style', phrase: 'prose style' },
  { value: 'dialogue', label: 'Dialogue', phrase: 'dialogue' },
  { value: 'description', label: 'Description', phrase: 'descriptive imagery' },
  { value: 'scene', label: 'Scene', phrase: 'scene construction' },
  { value: 'transition', label: 'Transition', phrase: 'transitions between ideas' },
] as const;

export type ImproveAspect = (typeof IMPROVE_ASPECTS)[number]['value'];

export interface WritingAction {
  kind: PolishActionKind;
  aspect?: ImproveAspect;
}

const PROMPT_KEYS: Record<PolishActionKind, string> = {
  improve: 'writing_assistant.improve',
  simplify: 'writing_assistant.simplify',
  condense: 'writing_assistant.condense',
};

const LABELS: Record<PolishActionKind, string> = {
  improve: 'Improve',
  simplify: 'Simplify',
  condense: 'Condense',
};

/** The actions offered as one-click buttons. `improve` is parametrised by an aspect. */
export const ONE_CLICK_ACTIONS: readonly PolishActionKind[] = ['simplify', 'condense'];

export function promptKeyOf(action: WritingAction): string {
  return PROMPT_KEYS[action.kind];
}

/** Variables for the template — must match the template's declared `variables`. */
export function promptVariablesOf(action: WritingAction): Record<string, unknown> {
  if (action.kind === 'improve') {
    const aspect = IMPROVE_ASPECTS.find((a) => a.value === action.aspect);
    return { aspect: aspect?.phrase ?? IMPROVE_ASPECTS[0].phrase };
  }
  return {};
}

/** Human label, used on the button and as the suggestion's provenance line. */
export function labelOf(action: WritingAction): string {
  if (action.kind === 'improve') {
    const aspect = IMPROVE_ASPECTS.find((a) => a.value === action.aspect);
    return `Improve ${(aspect?.label ?? '').toLowerCase()}`.trim();
  }
  return LABELS[action.kind];
}

/**
 * The default placement for a one-click accept. **Never destructive without a selection:** a
 * transform with nothing selected inserts below rather than replacing the entire document.
 *
 * The `isContinuation` branch this used to have is gone with the generation actions. Every remaining
 * action transforms an operand, so selection is now the only question — which is what the rule was
 * really about all along.
 */
export function defaultPlacement(
  _action: WritingAction,
  selectionPresent: boolean,
): AiSuggestionPlacement {
  return selectionPresent ? 'replace-selection' : 'insert-below';
}
