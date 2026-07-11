import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** AntD table density (maps to `Table` `size`). */
export type TableDensity = 'small' | 'middle' | 'large';

/** A saved filter preset — the URL search string plus a label. */
export interface SavedFilter {
  id: string;
  name: string;
  query: string;
}

interface UsersTablePrefsState {
  /** Column keys the operator has hidden (client-side only; backend returns all fields). */
  hiddenColumns: string[];
  density: TableDensity;
  savedFilters: SavedFilter[];
  toggleColumn: (key: string) => void;
  setColumnVisible: (key: string, visible: boolean) => void;
  setDensity: (density: TableDensity) => void;
  saveFilter: (name: string, query: string) => void;
  removeFilter: (id: string) => void;
}

/**
 * Persisted table preferences for the Users grid (column visibility, density,
 * saved filters). This is the ONLY Zustand state the feature owns — pure view
 * prefs, never server data (docs 12 §1; mirrors `sidebar.store` persist pattern).
 * Pagination/filters/sort live in the URL; row selection is local component state.
 */
export const useUsersTablePrefs = create<UsersTablePrefsState>()(
  persist(
    (set) => ({
      hiddenColumns: [],
      density: 'middle',
      savedFilters: [],
      toggleColumn: (key) =>
        set((state) => ({
          hiddenColumns: state.hiddenColumns.includes(key)
            ? state.hiddenColumns.filter((k) => k !== key)
            : [...state.hiddenColumns, key],
        })),
      setColumnVisible: (key, visible) =>
        set((state) => ({
          hiddenColumns: visible
            ? state.hiddenColumns.filter((k) => k !== key)
            : state.hiddenColumns.includes(key)
              ? state.hiddenColumns
              : [...state.hiddenColumns, key],
        })),
      setDensity: (density) => set({ density }),
      saveFilter: (name, query) =>
        set((state) => ({
          savedFilters: [
            ...state.savedFilters.filter((f) => f.name !== name),
            { id: crypto.randomUUID(), name, query },
          ],
        })),
      removeFilter: (id) =>
        set((state) => ({ savedFilters: state.savedFilters.filter((f) => f.id !== id) })),
    }),
    { name: 'qalam-admin-users-table' },
  ),
);
