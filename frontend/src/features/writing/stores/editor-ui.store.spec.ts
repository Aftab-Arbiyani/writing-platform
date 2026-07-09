import { beforeEach, describe, expect, it } from 'vitest';

import { useEditorUiStore } from './editor-ui.store';

describe('useEditorUiStore', () => {
  beforeEach(() => {
    useEditorUiStore.getState().reset();
  });

  it('flows through the save lifecycle', () => {
    const store = useEditorUiStore.getState();
    expect(store.saveStatus).toBe('idle');
    expect(store.isDirty).toBe(false);

    store.markDirty();
    expect(useEditorUiStore.getState().isDirty).toBe(true);

    store.markSaving();
    expect(useEditorUiStore.getState().saveStatus).toBe('saving');

    store.markSaved(1_000);
    const saved = useEditorUiStore.getState();
    expect(saved.saveStatus).toBe('saved');
    expect(saved.lastSavedAt).toBe(1_000);
    expect(saved.isDirty).toBe(false);
  });

  it('distinguishes offline vs generic save errors', () => {
    useEditorUiStore.getState().markError(true);
    expect(useEditorUiStore.getState().saveStatus).toBe('offline-error');
    useEditorUiStore.getState().markError(false);
    expect(useEditorUiStore.getState().saveStatus).toBe('error');
  });

  it('reset restores initial editor chrome', () => {
    const store = useEditorUiStore.getState();
    store.setPreviewOpen(true);
    store.setPublishOpen(true);
    store.markDirty();
    store.reset();
    const after = useEditorUiStore.getState();
    expect(after.previewOpen).toBe(false);
    expect(after.publishOpen).toBe(false);
    expect(after.isDirty).toBe(false);
    expect(after.saveStatus).toBe('idle');
  });
});
