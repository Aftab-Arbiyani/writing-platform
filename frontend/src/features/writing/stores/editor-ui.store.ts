import { create } from 'zustand';

/**
 * Editor UI state (docs/12 §5.1) — Zustand holds ONLY editor chrome: save status, the preview
 * panel, and the publish sheet. It never holds the document (TipTap owns that) nor server data
 * (TanStack Query owns that). Reset when the editor unmounts.
 */
export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error' | 'offline-error';
export type PreviewMode = 'desktop' | 'mobile';

interface EditorUiState {
  saveStatus: SaveStatus;
  lastSavedAt: number | null;
  /** Unsaved-changes flag — drives the beforeunload guard + the indicator. */
  isDirty: boolean;
  previewOpen: boolean;
  previewMode: PreviewMode;
  publishOpen: boolean;
  markDirty: () => void;
  markSaving: () => void;
  markSaved: (at: number) => void;
  markError: (offline: boolean) => void;
  setPreviewOpen: (open: boolean) => void;
  setPreviewMode: (mode: PreviewMode) => void;
  setPublishOpen: (open: boolean) => void;
  reset: () => void;
}

const INITIAL = {
  saveStatus: 'idle' as SaveStatus,
  lastSavedAt: null,
  isDirty: false,
  previewOpen: false,
  previewMode: 'desktop' as PreviewMode,
  publishOpen: false,
};

export const useEditorUiStore = create<EditorUiState>((set) => ({
  ...INITIAL,
  markDirty: () => {
    set({ isDirty: true });
  },
  markSaving: () => {
    set({ saveStatus: 'saving' });
  },
  markSaved: (at) => {
    set({ saveStatus: 'saved', lastSavedAt: at, isDirty: false });
  },
  markError: (offline) => {
    set({ saveStatus: offline ? 'offline-error' : 'error' });
  },
  setPreviewOpen: (previewOpen) => {
    set({ previewOpen });
  },
  setPreviewMode: (previewMode) => {
    set({ previewMode });
  },
  setPublishOpen: (publishOpen) => {
    set({ publishOpen });
  },
  reset: () => {
    set(INITIAL);
  },
}));
