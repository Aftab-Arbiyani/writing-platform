/**
 * Flattens a TipTap/ProseMirror JSON document to plain text — the input FTS and
 * word-count see (docs 04 §5). Pure and defensive: it walks `content` arrays and
 * concatenates `text` nodes, inserting a space between block nodes so words at
 * block boundaries don't fuse. Unknown shapes are ignored (never throws) — the
 * content schema itself is validated separately by the server sanitizer.
 */
export function extractPlainText(doc: unknown): string {
  const parts: string[] = [];
  walk(doc, parts);
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

function walk(node: unknown, out: string[]): void {
  if (node === null || typeof node !== 'object') {
    return;
  }
  const record = node as { type?: unknown; text?: unknown; content?: unknown };
  if (record.type === 'text' && typeof record.text === 'string') {
    out.push(record.text);
  }
  if (Array.isArray(record.content)) {
    for (const child of record.content) {
      walk(child, out);
    }
  }
}
