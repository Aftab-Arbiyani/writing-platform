import type { Editor } from '@tiptap/react';
import { useEffect } from 'react';

import {
  useAiEditorTarget,
  type AiEditorTarget,
  type AiSuggestionPlacement,
} from '@/stores/ai-editor-target.store';

/**
 * Publishes this editor to the AI panel (W2/AF2) by implementing the app-level
 * [`AiEditorTarget`](../../../stores/ai-editor-target.store.ts) seam.
 *
 * This is the writing feature's whole AI surface: no component here imports `features/ai`, and
 * nothing here knows what a prompt or a suggestion is. It answers "what is the writer working
 * on" and "put this text there", and the AI feature does the rest (docs/26 §4).
 *
 * **Every apply goes through TipTap commands**, so it enters the undo stack and fires `onUpdate`
 * — which means autosave, the dirty flag and the beforeunload guard all treat an accepted
 * suggestion as an ordinary edit. There is deliberately no AI-specific branch in any of them.
 */
function splitParagraphs(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter((block) => block !== '');
}

/** TipTap content for `text`, one paragraph per blank-line-separated block. */
function asParagraphs(
  text: string,
): { type: 'paragraph'; content?: { type: 'text'; text: string }[] }[] {
  return splitParagraphs(text).map((block) => ({
    type: 'paragraph' as const,
    content: [{ type: 'text' as const, text: block }],
  }));
}

export function useRegisterAiEditorTarget(args: {
  editor: Editor | null;
  title: string;
  languageCode: string;
  /**
   * The draft's SERVER id, or undefined while it is unsaved (W9). Published as-is: the story-scoped
   * AI surfaces need it and hide themselves without it, and a brand-new `/write` gains one the
   * moment autosave creates the piece (the route becomes `/write/:id`, which re-runs this effect).
   */
  pieceId?: string;
}): void {
  const { editor, title, languageCode, pieceId } = args;
  const register = useAiEditorTarget((s) => s.register);
  const unregister = useAiEditorTarget((s) => s.unregister);

  useEffect(() => {
    if (!editor) return;

    const target: AiEditorTarget = {
      getContext: () => {
        const { from, to, empty } = editor.state.selection;
        return {
          selectionText: empty ? '' : editor.state.doc.textBetween(from, to, '\n\n'),
          documentText: editor.getText(),
          title,
          language: languageCode,
          // The editor's own count, so the number the model is told matches the one on screen.
          wordCount: editor.getText().trim().split(/\s+/).filter(Boolean).length,
        };
      },

      apply: (text: string, placement: AiSuggestionPlacement): boolean => {
        const content = asParagraphs(text);
        if (content.length === 0) return false;

        if (placement === 'replace-selection') {
          // Refuse rather than silently replacing the whole document — a transform run with
          // nothing selected must not be able to wipe a chapter.
          if (editor.state.selection.empty) return false;
          // A single-block replacement goes in as INLINE text: the selection is usually a phrase
          // inside a sentence, and inserting a paragraph node there would split the sentence in
          // two. Multi-block replacements are genuinely paragraphs and go in as such.
          const blocks = splitParagraphs(text);
          const single = blocks.length === 1 ? blocks[0] : undefined;
          return editor
            .chain()
            .focus()
            .deleteSelection()
            .insertContent(single ?? content)
            .run();
        }

        if (placement === 'append') {
          return editor
            .chain()
            .focus('end')
            .insertContentAt(editor.state.doc.content.size, content)
            .run();
        }

        // insert-below: after the block the cursor (or the selection's end) sits in.
        const at = editor.state.selection.to;
        return editor.chain().focus().insertContentAt(at, content).run();
      },
    };

    register(target, pieceId ?? null);
    return () => {
      unregister();
    };
  }, [editor, title, languageCode, pieceId, register, unregister]);
}
