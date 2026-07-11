import { create } from 'zustand';

interface UnsavedChangesState {
  /** True while the active settings form has unsaved edits. */
  dirty: boolean;
  setDirty: (dirty: boolean) => void;
}

/**
 * Transient unsaved-changes flag (docs 24 — Zustand for unsaved changes). The
 * active form syncs its RHF `isDirty` here so the page-level navigation blocker
 * and the Save Bar can react without prop-drilling. Never persisted.
 */
export const useUnsavedChanges = create<UnsavedChangesState>((set) => ({
  dirty: false,
  setDirty: (dirty) => set({ dirty }),
}));
