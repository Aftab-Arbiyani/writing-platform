import { beforeEach, describe, expect, it } from 'vitest';

import { STORAGE_KEYS } from '@/lib/constants';

import { PROMPT_HISTORY_CAP } from '../lib/prompt-presets';
import { usePromptLibraryStore } from './prompt-library.store';

/**
 * The prompt library is the only copy of this data that exists — there is no server route behind it
 * (docs/48 §3.12) — so these specs treat it as a small persistence layer, not as UI state.
 */
describe('usePromptLibraryStore', () => {
  beforeEach(() => {
    localStorage.clear();
    usePromptLibraryStore.setState({ customPresets: [], favoriteIds: [], history: [] });
  });

  describe('favourites', () => {
    it('toggles on and back off', () => {
      const { toggleFavorite } = usePromptLibraryStore.getState();
      toggleFavorite('preset.novel');
      expect(usePromptLibraryStore.getState().isFavorite('preset.novel')).toBe(true);
      toggleFavorite('preset.novel');
      expect(usePromptLibraryStore.getState().isFavorite('preset.novel')).toBe(false);
    });

    it('favourites a built-in and a custom preset alike', () => {
      const created = usePromptLibraryStore
        .getState()
        .addCustomPreset({ title: 'Mine', instruction: 'Do the thing' });
      usePromptLibraryStore.getState().toggleFavorite('preset.essay');
      usePromptLibraryStore.getState().toggleFavorite(created.id);
      expect(usePromptLibraryStore.getState().favoriteIds).toEqual(['preset.essay', created.id]);
    });
  });

  describe('custom presets', () => {
    it('saves a preset with the custom kind and a trimmed instruction', () => {
      const created = usePromptLibraryStore
        .getState()
        .addCustomPreset({ title: '  Scene starter  ', instruction: '  Continue the scene.  ' });
      expect(created).toMatchObject({
        kind: 'custom',
        title: 'Scene starter',
        instruction: 'Continue the scene.',
        isBuiltIn: false,
      });
      expect(usePromptLibraryStore.getState().customPresets).toHaveLength(1);
    });

    it('falls back to a placeholder title when the writer leaves it blank', () => {
      // Mirrors mobile's `PromptPreset.custom` (prompt_preset.dart:60) — an untitled row is worse
      // than a generic one, because the list renders by title.
      const created = usePromptLibraryStore
        .getState()
        .addCustomPreset({ title: '   ', instruction: 'Something' });
      expect(created.title).toBe('Custom prompt');
    });

    it('gives concurrently-created presets distinct ids', () => {
      const first = usePromptLibraryStore
        .getState()
        .addCustomPreset({ title: 'A', instruction: 'a' });
      const second = usePromptLibraryStore
        .getState()
        .addCustomPreset({ title: 'B', instruction: 'b' });
      // Two presets saved inside the same millisecond must not collide — a same-id pair would make
      // delete remove both and favourite mark both.
      expect(first.id).not.toBe(second.id);
    });

    it('deleting a preset also drops its favourite', () => {
      const created = usePromptLibraryStore
        .getState()
        .addCustomPreset({ title: 'Mine', instruction: 'x' });
      usePromptLibraryStore.getState().toggleFavorite(created.id);
      usePromptLibraryStore.getState().deleteCustomPreset(created.id);
      expect(usePromptLibraryStore.getState().customPresets).toEqual([]);
      // A favourite pointing at a deleted preset would count toward the favourites tally forever.
      expect(usePromptLibraryStore.getState().favoriteIds).toEqual([]);
    });
  });

  describe('history', () => {
    it('records newest first', () => {
      const { recordUse } = usePromptLibraryStore.getState();
      recordUse('first');
      recordUse('second');
      expect(usePromptLibraryStore.getState().history).toEqual(['second', 'first']);
    });

    it('moves a repeated instruction to the top instead of duplicating it', () => {
      const { recordUse } = usePromptLibraryStore.getState();
      recordUse('alpha');
      recordUse('beta');
      recordUse('alpha');
      expect(usePromptLibraryStore.getState().history).toEqual(['alpha', 'beta']);
    });

    it('ignores blank input', () => {
      usePromptLibraryStore.getState().recordUse('   ');
      expect(usePromptLibraryStore.getState().history).toEqual([]);
    });

    it('caps the list', () => {
      const { recordUse } = usePromptLibraryStore.getState();
      for (let index = 0; index < PROMPT_HISTORY_CAP + 10; index += 1) {
        recordUse(`instruction ${index}`);
      }
      const { history } = usePromptLibraryStore.getState();
      expect(history).toHaveLength(PROMPT_HISTORY_CAP);
      expect(history[0]).toBe(`instruction ${PROMPT_HISTORY_CAP + 9}`);
    });

    it('clears', () => {
      usePromptLibraryStore.getState().recordUse('something');
      usePromptLibraryStore.getState().clearHistory();
      expect(usePromptLibraryStore.getState().history).toEqual([]);
    });
  });

  describe('persistence', () => {
    it('writes to the namespaced key', () => {
      usePromptLibraryStore.getState().recordUse('persisted');
      expect(localStorage.getItem(STORAGE_KEYS.promptLibrary)).toContain('persisted');
    });

    it('keeps a preset whose kind this build does not know, reading it as custom', () => {
      // Storage outlives builds and is user-editable. Dropping the row would lose a writer's saved
      // prompt over a renamed enum value; mobile's `fromName` falls back the same way.
      const rehydrated = usePromptLibraryStore.persist.getOptions().merge?.(
        {
          customPresets: [
            {
              id: 'c1',
              kind: 'from_a_future_build',
              title: 'T',
              instruction: 'i',
              isBuiltIn: false,
            },
          ],
          favoriteIds: ['c1'],
          history: ['h'],
        },
        usePromptLibraryStore.getState(),
      ) as { customPresets: Array<{ kind: string }> };

      expect(rehydrated.customPresets[0]?.kind).toBe('custom');
    });

    it('discards junk rather than crashing on rehydrate', () => {
      const rehydrated = usePromptLibraryStore.persist.getOptions().merge?.(
        {
          customPresets: [null, 42, { id: 'ok', instruction: 'i' }],
          favoriteIds: [1, 'keep'],
          history: [2, 'h'],
        },
        usePromptLibraryStore.getState(),
      ) as { customPresets: unknown[]; favoriteIds: unknown[]; history: unknown[] };

      expect(rehydrated.customPresets).toHaveLength(1);
      expect(rehydrated.favoriteIds).toEqual(['keep']);
      expect(rehydrated.history).toEqual(['h']);
    });

    it('never rehydrates a stored preset as built-in', () => {
      // Built-ins ship in code. A stored row claiming `isBuiltIn: true` would render undeletable.
      const rehydrated = usePromptLibraryStore.persist.getOptions().merge?.(
        {
          customPresets: [
            { id: 'c1', kind: 'custom', title: 'T', instruction: 'i', isBuiltIn: true },
          ],
        },
        usePromptLibraryStore.getState(),
      ) as { customPresets: Array<{ isBuiltIn: boolean }> };

      expect(rehydrated.customPresets[0]?.isBuiltIn).toBe(false);
    });
  });
});
