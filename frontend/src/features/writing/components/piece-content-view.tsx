import { EditorContent, useEditor } from '@tiptap/react';
import type { ReactElement } from 'react';

import type { TextDirection } from '@qalam/shared';

import { buildEditorExtensions } from '../editor/tiptap-extensions';
import type { TipTapDoc } from '../types/piece.types';

/**
 * Read-only render of a TipTap document — used by the preview. Reuses the SAME extension set as
 * the editor (so rendering is faithful and never diverges from what was written) with
 * `editable:false`. The `.qalam-prose` styles are shared with the editing surface.
 */
export function PieceContentView({
  content,
  direction,
}: {
  content: TipTapDoc;
  direction?: TextDirection;
}): ReactElement | null {
  const editor = useEditor({
    editable: false,
    extensions: buildEditorExtensions(),
    content,
    editorProps: {
      attributes: { class: 'qalam-prose', dir: direction ?? 'auto' },
    },
  });

  if (!editor) return null;
  return <EditorContent editor={editor} />;
}
