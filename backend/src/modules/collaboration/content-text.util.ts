/**
 * Minimal, self-contained plain-text extractor for a TipTap/ProseMirror document
 * (AF6). Used ONLY for suggestion conflict detection — walking the node tree and
 * concatenating every `text` leaf. Kept local (not imported from the pieces
 * module) so collaboration stays decoupled from that module's internals.
 */

interface RichTextNode {
  type?: string;
  text?: string;
  content?: RichTextNode[];
}

/** Concatenates every text leaf of a rich-text document into a single string. */
export function extractPlainText(doc: unknown): string {
  const parts: string[] = [];
  walk(doc as RichTextNode, parts);
  return parts.join('');
}

function walk(node: RichTextNode | null | undefined, out: string[]): void {
  if (node === null || node === undefined || typeof node !== 'object') {
    return;
  }
  if (typeof node.text === 'string') {
    out.push(node.text);
  }
  if (Array.isArray(node.content)) {
    for (const child of node.content) {
      walk(child, out);
    }
  }
}
