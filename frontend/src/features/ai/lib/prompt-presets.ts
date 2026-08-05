/**
 * Prompt Library presets (AF2, W8 C2) — ported from mobile's
 * `lib/features/ai/domain/value_objects/prompt_preset.dart`.
 *
 * A preset carries a short, user-editable **instruction** — a user message the assistant acts on —
 * and never an AI system prompt. That distinction is the rule this file exists to keep: system
 * prompts are server-side templates in the admin registry (`/admin/ai/prompts`, `ai.manage`-gated),
 * and a client that hardcoded model behaviour would be writing prompts the platform cannot version.
 * Presets are saved user messages.
 *
 * There is no wire here at all, on either platform — verified in docs/48 §3.12, not assumed. Built-in
 * presets ship in code; custom presets, favourites and history live on the device
 * (`stores/prompt-library.store.ts`, mirroring mobile's Hive-backed `PromptLibraryStore`).
 */

/** Preset categories, in the order mobile lists them (`prompt_preset.dart:11-28`). */
export const PROMPT_PRESET_KINDS = [
  'general_writing',
  'novel',
  'short_story',
  'essay',
  'blog',
  'poetry',
  'academic',
  'custom',
] as const;

export type PromptPresetKind = (typeof PROMPT_PRESET_KINDS)[number];

const KIND_LABELS: Readonly<Record<PromptPresetKind, string>> = {
  general_writing: 'General writing',
  novel: 'Novel',
  short_story: 'Short story',
  essay: 'Essay',
  blog: 'Blog',
  poetry: 'Poetry',
  academic: 'Academic',
  custom: 'Custom',
};

/** Human label for a kind; an unrecognised stored kind reads as Custom, as it does on mobile. */
export function presetKindLabel(kind: string): string {
  return KIND_LABELS[kind as PromptPresetKind] ?? KIND_LABELS.custom;
}

/** True for a kind this build knows — used when reading presets back out of storage. */
export function isPromptPresetKind(value: unknown): value is PromptPresetKind {
  return typeof value === 'string' && (PROMPT_PRESET_KINDS as readonly string[]).includes(value);
}

export interface PromptPreset {
  id: string;
  kind: PromptPresetKind;
  title: string;
  description: string;
  /** The starter instruction (a user message the assistant acts on). Editable. */
  instruction: string;
  isBuiltIn: boolean;
  /** ISO timestamp; built-ins have none. */
  createdAt?: string;
}

/**
 * The built-in preset shelf. Instructions are neutral, editable starting points — the writer tweaks
 * before sending. Ported verbatim (ids included) from `prompt_preset.dart:89-147` so a writer moving
 * between the two clients meets the same shelf, and so a future sync has stable ids to match on.
 */
export const BUILT_IN_PROMPT_PRESETS: readonly PromptPreset[] = [
  {
    id: 'preset.general_writing',
    kind: 'general_writing',
    title: 'General writing',
    description: 'Improve any passage while keeping your voice.',
    instruction: 'Help me improve this passage while keeping my voice and meaning intact.',
    isBuiltIn: true,
  },
  {
    id: 'preset.novel',
    kind: 'novel',
    title: 'Novel',
    description: 'Continue a scene with consistent POV and tense.',
    instruction:
      'Continue this scene, keeping the point of view and tense consistent, with vivid sensory detail.',
    isBuiltIn: true,
  },
  {
    id: 'preset.short_story',
    kind: 'short_story',
    title: 'Short story',
    description: 'Tighten an opening so it hooks the reader.',
    instruction: 'Tighten this short story’s opening so it hooks the reader immediately.',
    isBuiltIn: true,
  },
  {
    id: 'preset.essay',
    kind: 'essay',
    title: 'Essay',
    description: 'Sharpen an argument and clarify reasoning.',
    instruction: 'Sharpen the argument in this passage and make the reasoning clearer.',
    isBuiltIn: true,
  },
  {
    id: 'preset.blog',
    kind: 'blog',
    title: 'Blog',
    description: 'Rewrite in a friendly, engaging blog voice.',
    instruction: 'Rewrite this in a friendly, engaging blog voice with a strong opening line.',
    isBuiltIn: true,
  },
  {
    id: 'preset.poetry',
    kind: 'poetry',
    title: 'Poetry',
    description: 'Suggest more evocative imagery.',
    instruction: 'Suggest more evocative imagery for these lines without changing their meaning.',
    isBuiltIn: true,
  },
  {
    id: 'preset.academic',
    kind: 'academic',
    title: 'Academic',
    description: 'Rewrite in a precise, formal register.',
    instruction: 'Rewrite this in a precise, formal academic register.',
    isBuiltIn: true,
  },
];

/** How many remembered instructions to keep (mobile's `PromptLibraryStore.historyCap`). */
export const PROMPT_HISTORY_CAP = 30;

/**
 * Build a custom preset from a title + instruction, mirroring `PromptPreset.custom`
 * (`prompt_preset.dart:51-64`) including its blank-title fallback.
 *
 * `id` and `createdAt` are injected rather than generated here so the store owns identity and this
 * stays a pure function the specs can pin.
 */
export function makeCustomPreset(args: {
  id: string;
  title: string;
  instruction: string;
  createdAt: string;
}): PromptPreset {
  const title = args.title.trim();
  return {
    id: args.id,
    kind: 'custom',
    title: title === '' ? 'Custom prompt' : title,
    description: 'Your saved prompt',
    instruction: args.instruction.trim(),
    isBuiltIn: false,
    createdAt: args.createdAt,
  };
}
