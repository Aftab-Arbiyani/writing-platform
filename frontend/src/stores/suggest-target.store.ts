import { create } from 'zustand';

/**
 * The seam between the reader and the "propose an edit" composer (AF6, C-15 — docs/48 §3.22a).
 *
 * **Why it exists at all.** The prose and its per-block anchors live in `features/reading`; the
 * composer, the capability check and `addSuggestion` live in `features/collaboration`; and a
 * feature may never import another feature (docs/26 §4). Both may import app-level code, so the
 * contract lives here — exactly the shape [`ai-editor-target.store`](./ai-editor-target.store.ts)
 * uses for the editor/assistant pair: the READER publishes what it is showing, the COMPOSER
 * consumes whatever is published, and the composer is inert on any screen where no reader
 * registered.
 *
 * **The reader never learns what a suggestion is.** It answers "which passage did the person
 * pick", and the collaboration feature does the rest — no import, no suggestion vocabulary, and
 * nothing to unwind if the composer is switched off.
 */

/**
 * One selected passage, in the SERVER's `anchorText` coordinate space.
 *
 * Structurally identical to `features/reading`'s `BlockAnchor` and deliberately re-declared rather
 * than imported: app-level code must not depend on a feature (the dependency runs the other way).
 * It is three primitives, and the reading feature's own type is the one under test against the
 * server — see `features/reading/lib/content-anchors.ts`, whose spec pins these offsets against a
 * reimplementation of the backend's `anchorText`.
 */
export interface SuggestSelection {
  readonly from: number;
  readonly to: number;
  /** The passage exactly as it exists in `anchorText` — the server's `originalText`. */
  readonly text: string;
}

interface SuggestTargetState {
  /**
   * The story the reader is showing, or null when no reader is mounted.
   *
   * This is the piece id: mobile passes `piece.id` as the story id on the same call
   * (`reading_screen.dart`), and that path is live-verified end-to-end (docs/48, eleventh
   * reconciliation), so the two identifier spaces are the same one.
   */
  storyId: string | null;
  /**
   * Whether the reader is in "pick a passage" mode.
   *
   * It lives on the seam rather than inside either feature because both halves need it: the
   * collaboration side owns the toggle and the banner, while the reading side has to make blocks
   * selectable. Same division as the assistant seam's `open`.
   */
  picking: boolean;
  /** The passage the reader picked, consumed by the composer and cleared when it closes. */
  selection: SuggestSelection | null;
  /** Called by the reader on mount / when the piece changes. */
  register: (storyId: string) => void;
  /** Called by the reader on unmount — clears the mode too, so it never leaks to the next page. */
  unregister: () => void;
  setPicking: (picking: boolean) => void;
  /** Called by the reader when a block is chosen; ends picking, since one pick opens one composer. */
  select: (selection: SuggestSelection) => void;
  /** Called by the composer when it closes, whether or not anything was sent. */
  clearSelection: () => void;
}

export const useSuggestTarget = create<SuggestTargetState>((set) => ({
  storyId: null,
  picking: false,
  selection: null,

  // Registering a DIFFERENT piece resets the mode and any pending pick: an anchor is meaningless
  // against another document, and carrying one across a navigation is how a suggestion lands on
  // the wrong passage. Re-registering the same id leaves state alone, so a re-render is inert.
  register: (storyId) =>
    set((s) => (s.storyId === storyId ? s : { storyId, picking: false, selection: null })),

  unregister: () => set({ storyId: null, picking: false, selection: null }),

  // Entering the mode clears any stale pick; leaving it does not touch `selection`, because the
  // composer is what owns clearing that and `select()` turns picking off before the composer opens.
  // Written as two explicit branches rather than one object with a conditional value: Zustand
  // merges shallowly, so an `undefined` in the patch OVERWRITES rather than skips.
  setPicking: (picking) => set(picking ? { picking: true, selection: null } : { picking: false }),

  select: (selection) => set({ selection, picking: false }),

  clearSelection: () => set({ selection: null }),
}));
