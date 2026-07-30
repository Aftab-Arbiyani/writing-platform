import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type TableDensity = 'small' | 'middle' | 'large';

interface ModerationPrefsState {
  hiddenColumns: string[];
  density: TableDensity;
  toggleColumn: (key: string) => void;
  setDensity: (density: TableDensity) => void;
}

/**
 * Persisted moderation table/moderator preferences (column visibility, density).
 * The only Zustand state the feature owns — pure view prefs, never server data
 * (docs 12 §1; mirrors `sidebar.store`). Filters/pagination/sort live in the URL;
 * selection is local component state.
 */
export const useModerationPrefs = create<ModerationPrefsState>()(
  persist(
    (set) => ({
      hiddenColumns: ['reporter'],
      density: 'middle',
      toggleColumn: (key) =>
        set((state) => ({
          hiddenColumns: state.hiddenColumns.includes(key)
            ? state.hiddenColumns.filter((k) => k !== key)
            : [...state.hiddenColumns, key],
        })),
      setDensity: (density) => set({ density }),
    }),
    { name: 'qalam-admin-moderation' },
  ),
);
