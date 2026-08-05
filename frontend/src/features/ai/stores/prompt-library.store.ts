import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { STORAGE_KEYS } from '@/lib/constants';

import {
  isPromptPresetKind,
  makeCustomPreset,
  PROMPT_HISTORY_CAP,
  type PromptPreset,
} from '../lib/prompt-presets';

/**
 * Prompt Library CLIENT state (AF2 W8 C2) — the web port of mobile's `PromptLibraryStore` +
 * `PromptLibraryController` (`prompt_library_store.dart`, `prompt_library_controller.dart`).
 *
 * All of it belongs in Zustand rather than TanStack Query because the server owns none of it: there
 * is no prompt-preset route on the frozen v1 (docs/48 §3.12 verified this rather than assuming it),
 * so this store is not a cache of anything — it is the data.
 *
 * Persisted whole (no `partialize`): every field here is durable by design. Built-in presets are NOT
 * stored — they ship in code, so a build that edits the shelf takes effect immediately instead of
 * being shadowed by a stale copy in `localStorage`.
 *
 * Subscribe with narrow selectors (`usePromptLibraryStore(s => s.favoriteIds)`).
 */

interface PromptLibraryState {
  /** The writer's own presets, oldest first (mobile appends). */
  customPresets: PromptPreset[];
  /** Favourited preset ids — built-in or custom. An array, not a Set: `persist` must serialize it. */
  favoriteIds: string[];
  /** Recently used instructions, newest first, de-duplicated, capped at `PROMPT_HISTORY_CAP`. */
  history: string[];

  /**
   * A preset the writer chose to use, waiting for the editor's assistant to pick it up (W8).
   *
   * Transient and deliberately NOT persisted (see `partialize`): it is a hand-off across one
   * navigation, not a preference. Persisting it would prefill the Ask AI box from a prompt chosen days
   * ago, on a draft it was never meant for.
   */
  pendingInstruction: string | null;

  toggleFavorite: (id: string) => void;
  isFavorite: (id: string) => boolean;
  /** Save a new custom preset; returns it so a caller can select/announce it. */
  addCustomPreset: (args: { title: string; instruction: string }) => PromptPreset;
  /** Forget a custom preset, and its favourite along with it. */
  deleteCustomPreset: (id: string) => void;
  /** Record a used instruction at the top of history (no-op for blank input). */
  recordUse: (instruction: string) => void;
  clearHistory: () => void;

  /** Hand a preset to the editor's assistant, and record it as used. */
  sendToAssistant: (instruction: string) => void;
  /** Read and clear the pending instruction — the assistant consumes it exactly once. */
  takePendingInstruction: () => string | null;
}

export const usePromptLibraryStore = create<PromptLibraryState>()(
  persist(
    (set, get) => ({
      customPresets: [],
      favoriteIds: [],
      history: [],
      pendingInstruction: null,

      toggleFavorite: (id) => {
        set((state) => ({
          favoriteIds: state.favoriteIds.includes(id)
            ? state.favoriteIds.filter((existing) => existing !== id)
            : [...state.favoriteIds, id],
        }));
      },

      isFavorite: (id) => get().favoriteIds.includes(id),

      addCustomPreset: ({ title, instruction }) => {
        // `crypto.randomUUID` needs a secure context; `Date.now()` is mobile's own id scheme
        // (`custom-${microsecondsSinceEpoch}`) and is enough for a device-local list.
        const preset = makeCustomPreset({
          id: `custom-${Date.now().toString(36)}-${get().customPresets.length}`,
          title,
          instruction,
          createdAt: new Date().toISOString(),
        });
        set((state) => ({ customPresets: [...state.customPresets, preset] }));
        return preset;
      },

      deleteCustomPreset: (id) => {
        set((state) => ({
          customPresets: state.customPresets.filter((preset) => preset.id !== id),
          favoriteIds: state.favoriteIds.filter((existing) => existing !== id),
        }));
      },

      recordUse: (instruction) => {
        const trimmed = instruction.trim();
        if (trimmed === '') return;
        set((state) => ({
          history: [trimmed, ...state.history.filter((entry) => entry !== trimmed)].slice(
            0,
            PROMPT_HISTORY_CAP,
          ),
        }));
      },

      clearHistory: () => {
        set({ history: [] });
      },

      sendToAssistant: (instruction) => {
        const trimmed = instruction.trim();
        if (trimmed === '') return;
        get().recordUse(trimmed);
        set({ pendingInstruction: trimmed });
      },

      takePendingInstruction: () => {
        const pending = get().pendingInstruction;
        if (pending !== null) set({ pendingInstruction: null });
        return pending;
      },
    }),
    {
      name: STORAGE_KEYS.promptLibrary,
      version: 1,
      /**
       * Only the durable three. `pendingInstruction` is a one-navigation hand-off — persisting it
       * would prefill the assistant from a prompt chosen in a previous session.
       */
      partialize: (state) => ({
        customPresets: state.customPresets,
        favoriteIds: state.favoriteIds,
        history: state.history,
      }),
      /**
       * Storage is user-editable and survives across builds, so it is validated on the way in rather
       * than trusted. A preset whose `kind` this build does not know is kept and read as `custom`
       * (matching mobile's `PromptPresetKind.fromName` fallback) instead of being dropped — losing a
       * writer's saved prompt to a renamed enum value would be the worse failure.
       */
      merge: (persisted, current) => {
        const stored = (persisted ?? {}) as Partial<PromptLibraryState>;
        const customPresets = Array.isArray(stored.customPresets)
          ? stored.customPresets
              .filter(
                (preset): preset is PromptPreset =>
                  typeof preset === 'object' &&
                  preset !== null &&
                  typeof (preset as PromptPreset).id === 'string' &&
                  typeof (preset as PromptPreset).instruction === 'string',
              )
              .map((preset) => ({
                ...preset,
                kind: isPromptPresetKind(preset.kind) ? preset.kind : ('custom' as const),
                title: typeof preset.title === 'string' ? preset.title : 'Custom prompt',
                description: typeof preset.description === 'string' ? preset.description : '',
                isBuiltIn: false,
              }))
          : [];

        return {
          ...current,
          customPresets,
          favoriteIds: Array.isArray(stored.favoriteIds)
            ? stored.favoriteIds.filter((id): id is string => typeof id === 'string')
            : [],
          history: Array.isArray(stored.history)
            ? stored.history
                .filter((entry): entry is string => typeof entry === 'string')
                .slice(0, PROMPT_HISTORY_CAP)
            : [],
        };
      },
    },
  ),
);
