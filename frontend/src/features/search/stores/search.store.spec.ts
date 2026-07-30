import { beforeEach, describe, expect, it } from 'vitest';

import { RECENT_SEARCH_LIMIT, useSearchStore } from './search.store';

const reset = (): void => {
  useSearchStore.setState({ recent: [], commandOpen: false, filterPanelOpen: false });
};

describe('useSearchStore', () => {
  beforeEach(reset);

  describe('recent searches', () => {
    it('adds a query to the front, newest first', () => {
      const { addRecent } = useSearchStore.getState();
      addRecent('barish');
      addRecent('shaam');
      expect(useSearchStore.getState().recent).toEqual(['shaam', 'barish']);
    });

    it('trims and ignores blank input', () => {
      const { addRecent } = useSearchStore.getState();
      addRecent('   ');
      addRecent('  ishq  ');
      expect(useSearchStore.getState().recent).toEqual(['ishq']);
    });

    it('de-duplicates case-insensitively, moving the repeat to the front', () => {
      const { addRecent } = useSearchStore.getState();
      addRecent('Ghazal');
      addRecent('nazm');
      addRecent('ghazal'); // same term, different case
      expect(useSearchStore.getState().recent).toEqual(['ghazal', 'nazm']);
    });

    it('caps the history at the limit', () => {
      const { addRecent } = useSearchStore.getState();
      for (let i = 0; i < RECENT_SEARCH_LIMIT + 5; i += 1) addRecent(`q${String(i)}`);
      expect(useSearchStore.getState().recent).toHaveLength(RECENT_SEARCH_LIMIT);
      // The most recent should be at the front.
      expect(useSearchStore.getState().recent[0]).toBe(`q${String(RECENT_SEARCH_LIMIT + 4)}`);
    });

    it('removes a query case-insensitively', () => {
      const { addRecent, removeRecent } = useSearchStore.getState();
      addRecent('barish');
      addRecent('shaam');
      removeRecent('BARISH');
      expect(useSearchStore.getState().recent).toEqual(['shaam']);
    });

    it('clears the whole history', () => {
      const { addRecent, clearRecent } = useSearchStore.getState();
      addRecent('a');
      addRecent('b');
      clearRecent();
      expect(useSearchStore.getState().recent).toEqual([]);
    });
  });

  describe('UI state', () => {
    it('opens and closes the command dropdown', () => {
      useSearchStore.getState().openCommand();
      expect(useSearchStore.getState().commandOpen).toBe(true);
      useSearchStore.getState().closeCommand();
      expect(useSearchStore.getState().commandOpen).toBe(false);
    });

    it('toggles the filter panel', () => {
      expect(useSearchStore.getState().filterPanelOpen).toBe(false);
      useSearchStore.getState().toggleFilterPanel();
      expect(useSearchStore.getState().filterPanelOpen).toBe(true);
      useSearchStore.getState().closeFilterPanel();
      expect(useSearchStore.getState().filterPanelOpen).toBe(false);
    });
  });
});
