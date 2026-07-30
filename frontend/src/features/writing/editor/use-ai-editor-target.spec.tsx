import { renderHook } from '@testing-library/react';
import { Editor } from '@tiptap/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { useAiEditorTarget } from '@/stores/ai-editor-target.store';

import { buildEditorExtensions } from './tiptap-extensions';
import { useRegisterAiEditorTarget } from './use-ai-editor-target';

/**
 * These run against a REAL TipTap editor rather than a mock: the whole point of the seam is that
 * every apply goes through editor commands (so autosave and undo keep working), and a mocked
 * chain would assert nothing about that.
 */
function makeEditor(text: string): Editor {
  return new Editor({
    extensions: buildEditorExtensions(),
    content:
      text === ''
        ? { type: 'doc', content: [] }
        : { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] },
  });
}

function register(editor: Editor) {
  return renderHook(() =>
    useRegisterAiEditorTarget({ editor, title: 'A door never opened', languageCode: 'ur' }),
  );
}

const target = () => useAiEditorTarget.getState().target;

describe('useRegisterAiEditorTarget', () => {
  let editor: Editor;

  beforeEach(() => {
    useAiEditorTarget.setState({ target: null, open: false });
  });

  afterEach(() => {
    editor.destroy();
  });

  it('registers on mount and unregisters on unmount', () => {
    editor = makeEditor('Hello world');
    const { unmount } = register(editor);
    expect(target()).not.toBeNull();

    unmount();
    expect(target()).toBeNull();
  });

  it('closes the panel when the editor goes away', () => {
    // Otherwise the drawer lingers over a page with no editor behind it.
    editor = makeEditor('Hello world');
    const { unmount } = register(editor);
    useAiEditorTarget.getState().setOpen(true);

    unmount();
    expect(useAiEditorTarget.getState().open).toBe(false);
  });

  it('reports the document, title, language and word count', () => {
    editor = makeEditor('One two three four');
    register(editor);

    const context = target()?.getContext();
    expect(context).toMatchObject({
      documentText: 'One two three four',
      title: 'A door never opened',
      language: 'ur',
      wordCount: 4,
    });
    expect(context?.selectionText).toBe('');
  });

  it('reports the selection when there is one', () => {
    editor = makeEditor('One two three four');
    register(editor);
    // "One" — TipTap positions are 1-based with the doc node at 0.
    editor.commands.setTextSelection({ from: 1, to: 4 });

    expect(target()?.getContext().selectionText).toBe('One');
  });

  it('inserts below without destroying what is already there', () => {
    editor = makeEditor('Original line');
    register(editor);

    expect(target()?.apply('Added line', 'insert-below')).toBe(true);
    expect(editor.getText()).toContain('Original line');
    expect(editor.getText()).toContain('Added line');
  });

  it('replaces the selection when one exists', () => {
    editor = makeEditor('keep this replace');
    register(editor);
    editor.commands.setTextSelection({ from: 11, to: 18 }); // "replace"

    expect(target()?.apply('REPLACED', 'replace-selection')).toBe(true);
    expect(editor.getText()).toBe('keep this REPLACED');
  });

  it('REFUSES replace-selection when nothing is selected', () => {
    // The safety invariant: a transform run with no selection must never wipe the document.
    editor = makeEditor('The whole chapter');
    register(editor);

    expect(target()?.apply('Something else', 'replace-selection')).toBe(false);
    expect(editor.getText()).toBe('The whole chapter');
  });

  it('keeps a multi-block replacement as separate paragraphs', () => {
    editor = makeEditor('one two');
    register(editor);
    editor.commands.setTextSelection({ from: 1, to: 8 });

    expect(target()?.apply('First para.\n\nSecond para.', 'replace-selection')).toBe(true);
    expect(editor.getJSON().content?.filter((node) => node.type === 'paragraph').length).toBe(2);
  });

  it('splits blank-line-separated blocks into separate paragraphs', () => {
    editor = makeEditor('Start');
    register(editor);

    target()?.apply('First para.\n\nSecond para.', 'append');
    expect(editor.getJSON().content?.filter((node) => node.type === 'paragraph').length).toBe(3);
  });

  it('refuses to apply blank text', () => {
    editor = makeEditor('Untouched');
    register(editor);

    expect(target()?.apply('   \n\n  ', 'append')).toBe(false);
    expect(editor.getText()).toBe('Untouched');
  });

  it('applies through commands, so the change is undoable as an ordinary edit', () => {
    // This is what keeps autosave/undo free of AI-specific branches.
    editor = makeEditor('Original');
    register(editor);
    target()?.apply('Added', 'append');
    expect(editor.getText()).toContain('Added');

    editor.commands.undo();
    expect(editor.getText()).not.toContain('Added');
  });
});
