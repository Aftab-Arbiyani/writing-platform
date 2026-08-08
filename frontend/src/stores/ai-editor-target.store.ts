import { create } from 'zustand';

/**
 * The seam between the AI writing assistant and whatever document editor is on screen
 * (W2/AF2, docs/45 §4.2) — the web analog of mobile's `AiEditorTarget`.
 *
 * **Why it exists at all.** The assistant UI lives in `features/ai` and the editor lives in
 * `features/writing`, and a feature may never import another feature (docs/26 §4). Both may
 * import app-level code, so the contract lives here: the editor *registers* an implementation
 * when it mounts, the assistant *consumes* whatever is registered. Neither knows the other's
 * module, and the assistant is inert on any screen where no editor registered.
 *
 * **The AI never mutates the document.** It hands text to the target, and the target applies it
 * through the editor's own commands — so autosave, undo history and the dirty flag keep working
 * with no AI-specific branches anywhere in the writing feature.
 */

/** Where an accepted suggestion lands. */
export type AiSuggestionPlacement = 'replace-selection' | 'insert-below' | 'append';

/**
 * A snapshot of what the writer is working on, built by the EDITOR and handed to the AI layer
 * so the AI feature never reaches into the editor's internals. Mirrors mobile's
 * `AiWritingContext`.
 */
export interface AiWritingContext {
  /** The current selection ('' when nothing is selected). */
  selectionText: string;
  /** The whole document as plain text. */
  documentText: string;
  title: string;
  /** Language name or code — framing that matters for Hindi/Urdu generation. */
  language: string;
  wordCount: number;
}

/** What the editor exposes to the assistant. */
export interface AiEditorTarget {
  /** The context captured at the moment it is read (never cached by the assistant). */
  getContext: () => AiWritingContext;
  /**
   * Apply `text` to the document. Returns false when the placement could not be honoured
   * (e.g. replace-selection with nothing selected), so the caller can tell the writer.
   */
  apply: (text: string, placement: AiSuggestionPlacement) => boolean;
}

interface AiEditorTargetState {
  target: AiEditorTarget | null;
  /**
   * The SERVER piece id of the draft being edited, or null when it has never synced (W9).
   *
   * Story Explorer and Ask My Book are **per-story**: both take this id, both are owner-scoped
   * server-side, and a draft that exists only in the browser has no story to explore or ask about
   * — so surfaces that need it stay hidden until it is present. It rides the same seam rather than
   * `AiEditorTarget` because it is a FACT about the document, not a capability of the editor:
   * `getContext()` answers "what is the writer working on", and a target with no server id is still
   * a perfectly good assistant target. This is the web analog of mobile's `st.draft.isRemote` gate
   * (`editor_screen.dart:245`).
   */
  storyId: string | null;
  /** Whether the assistant panel is open. Part of the same seam: the toggle lives in the
   *  editor's header (writing) while the panel itself is rendered by the AI feature. */
  open: boolean;
  register: (target: AiEditorTarget, storyId: string | null) => void;
  unregister: () => void;
  setOpen: (open: boolean) => void;
}

/** The operand a transform acts on: the selection when there is one, else the whole document. */
export function operandOf(context: AiWritingContext): string {
  const selection = context.selectionText.trim();
  return selection === '' ? context.documentText.trim() : selection;
}

export function hasSelection(context: AiWritingContext): boolean {
  return context.selectionText.trim() !== '';
}

export const useAiEditorTarget = create<AiEditorTargetState>((set) => ({
  target: null,
  storyId: null,
  open: false,
  register: (target, storyId) => {
    set({ target, storyId });
  },
  // Closing on unregister matters: the panel must not linger over a screen with no editor
  // behind it (navigating away from /write while it is open).
  unregister: () => {
    set({ target: null, storyId: null, open: false });
  },
  setOpen: (open) => {
    set({ open });
  },
}));
