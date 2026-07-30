import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type TableDensity = 'small' | 'middle' | 'large';

interface AuditPrefsState {
  hiddenColumns: string[];
  density: TableDensity;
  toggleColumn: (key: string) => void;
  setDensity: (density: TableDensity) => void;
}

/**
 * Persisted audit-table preferences (column visibility, density) — the only
 * Zustand state the feature owns (docs 12 §1; `sidebar.store` pattern). Filters/
 * pagination/sort live in the URL; selection is not used (audit is read-only).
 */
export const useAuditPrefs = create<AuditPrefsState>()(
  persist(
    (set) => ({
      hiddenColumns: ['ip'],
      density: 'middle',
      toggleColumn: (key) =>
        set((state) => ({
          hiddenColumns: state.hiddenColumns.includes(key)
            ? state.hiddenColumns.filter((k) => k !== key)
            : [...state.hiddenColumns, key],
        })),
      setDensity: (density) => set({ density }),
    }),
    { name: 'qalam-admin-audit' },
  ),
);
