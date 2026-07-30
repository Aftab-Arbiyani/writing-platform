import Placeholder from '@tiptap/extension-placeholder';
import TextAlign from '@tiptap/extension-text-align';
import StarterKit from '@tiptap/starter-kit';

/**
 * The editor's extension set — configured to EXACTLY match the server content whitelist
 * (`backend/.../content-sanitizer.ts`, docs/13 §5.2). Anything the server rejects is disabled
 * here so the editor can never produce a document that fails to save:
 *
 * - marks: bold, italic, underline ONLY → `link`, `strike`, `code` disabled.
 * - nodes: paragraph, headings (2–4), blockquote, bullet/ordered lists, hardBreak → `codeBlock`
 *   and `horizontalRule` disabled (not whitelisted).
 * - `textAlign` on paragraphs + headings (left/center/right/justify).
 *
 * Mentions (`mention`) + hashtags (`hashtag`) nodes are whitelisted server-side, but authoring
 * them needs a user-search picker (out of F4 scope) — typed `@handle`/`#tag` stay as plain text
 * and the backend extracts tags from the `tags` field. Undo/redo come from StarterKit's history.
 */
export function buildEditorExtensions(placeholder = 'Tell your story…') {
  return [
    StarterKit.configure({
      heading: { levels: [2, 3, 4] },
      link: false,
      strike: false,
      code: false,
      codeBlock: false,
      horizontalRule: false,
    }),
    TextAlign.configure({
      types: ['heading', 'paragraph'],
      alignments: ['left', 'center', 'right', 'justify'],
    }),
    Placeholder.configure({ placeholder }),
  ];
}
