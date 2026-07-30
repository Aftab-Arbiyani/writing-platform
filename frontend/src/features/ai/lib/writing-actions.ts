import type { AiSuggestionPlacement } from '@/stores/ai-editor-target.store';

/**
 * Writing Assistant actions (W2/AF2) — the client vocabulary mapping each user action to a
 * **server** prompt-template key plus its declared variables.
 *
 * This file holds **no prompt text**. Bodies live only on the server, versioned
 * (`backend/src/modules/ai/prompts/prompt-catalog.ts`); hardcoding a prompt in the UI would fork
 * it from the version the server actually renders. Only identifiers and display copy live here.
 *
 * All eight actions are the single `writing_assistant` AI feature — one flag for the whole
 * in-editor assistant. The specific action is a prompt key, never a distinct feature
 * (`packages/shared/src/ai.ts`).
 */

export type AssistantActionKind =
  'continue' | 'rewrite' | 'expand' | 'condense' | 'simplify' | 'improve' | 'tone' | 'freeform';

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

/** Target tone. The phrase is sent as the `{{tone}}` template variable. */
export const WRITING_TONES = [
  { value: 'formal', label: 'Formal', phrase: 'formal' },
  { value: 'casual', label: 'Casual', phrase: 'casual and conversational' },
  { value: 'poetic', label: 'Poetic', phrase: 'poetic and lyrical' },
  { value: 'professional', label: 'Professional', phrase: 'professional' },
  { value: 'suspenseful', label: 'Suspenseful', phrase: 'suspenseful and tense' },
  { value: 'inspirational', label: 'Inspirational', phrase: 'inspirational and uplifting' },
] as const;

export type ImproveAspect = (typeof IMPROVE_ASPECTS)[number]['value'];
export type WritingTone = (typeof WRITING_TONES)[number]['value'];

export interface WritingAction {
  kind: AssistantActionKind;
  aspect?: ImproveAspect;
  tone?: WritingTone;
}

const PROMPT_KEYS: Record<AssistantActionKind, string> = {
  continue: 'writing_assistant.continue',
  rewrite: 'writing_assistant.rewrite',
  expand: 'writing_assistant.expand',
  condense: 'writing_assistant.condense',
  simplify: 'writing_assistant.simplify',
  improve: 'writing_assistant.improve',
  tone: 'writing_assistant.tone',
  freeform: 'writing_assistant.freeform',
};

const LABELS: Record<AssistantActionKind, string> = {
  continue: 'Continue writing',
  rewrite: 'Rewrite',
  expand: 'Expand',
  condense: 'Condense',
  simplify: 'Simplify',
  improve: 'Improve',
  tone: 'Tone',
  freeform: 'Ask AI',
};

/** The quick actions offered as one-click buttons (improve/tone/freeform are parametrised). */
export const QUICK_ACTIONS: readonly AssistantActionKind[] = [
  'continue',
  'rewrite',
  'expand',
  'condense',
  'simplify',
];

export function promptKeyOf(action: WritingAction): string {
  return PROMPT_KEYS[action.kind];
}

/** Variables for the template — must match the template's declared `variables`. */
export function promptVariablesOf(action: WritingAction): Record<string, unknown> {
  if (action.kind === 'improve') {
    const aspect = IMPROVE_ASPECTS.find((a) => a.value === action.aspect);
    return { aspect: aspect?.phrase ?? IMPROVE_ASPECTS[0].phrase };
  }
  if (action.kind === 'tone') {
    const tone = WRITING_TONES.find((t) => t.value === action.tone);
    return { tone: tone?.phrase ?? WRITING_TONES[0].phrase };
  }
  return {};
}

/** Human label, used on the button and as the suggestion's provenance line. */
export function labelOf(action: WritingAction): string {
  if (action.kind === 'improve') {
    const aspect = IMPROVE_ASPECTS.find((a) => a.value === action.aspect);
    return `Improve ${(aspect?.label ?? '').toLowerCase()}`.trim();
  }
  if (action.kind === 'tone') {
    const tone = WRITING_TONES.find((t) => t.value === action.tone);
    return `${tone?.label ?? ''} tone`.trim();
  }
  return LABELS[action.kind];
}

/** Continuations grow the text; everything else transforms an operand. */
export function isContinuation(action: WritingAction): boolean {
  return action.kind === 'continue' || action.kind === 'freeform';
}

/**
 * The default placement for a one-click accept. **Never destructive without a selection:** a
 * transform with nothing selected inserts below rather than replacing the entire document.
 */
export function defaultPlacement(
  action: WritingAction,
  selectionPresent: boolean,
): AiSuggestionPlacement {
  if (isContinuation(action)) return 'insert-below';
  return selectionPresent ? 'replace-selection' : 'insert-below';
}
