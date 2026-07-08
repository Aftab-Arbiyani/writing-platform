import { PieceContentInvalidException } from '../exceptions/pieces.exceptions';

/**
 * Server-side TipTap schema whitelist (docs 13 §5.2). Client editor constraints
 * are UX, not security — the server re-validates every stored document. Unknown
 * node/mark types and non-whitelisted attributes are **rejected (not stripped)**:
 * silent stripping hides attacks and corrupts author intent (docs 13 §5.2).
 *
 * Mirrors the Phase-1 editor spec (ADR §10): bold/italic/underline marks;
 * blockquote/lists/headings/footnotes/mentions/hashtags nodes; alignment on
 * paragraphs. No `link` mark (the most XSS-prone) — it isn't in the editor yet.
 * Depth + node-count caps defend the parser against pathological input.
 */
const MAX_DEPTH = 32;
const MAX_NODES = 10_000;
const ALLOWED_MARKS = new Set(['bold', 'italic', 'underline']);
const ALLOWED_ALIGN = new Set(['left', 'right', 'center', 'justify']);

/** node type → the attribute keys it may carry (any other attr is rejected). */
const NODE_ATTRS: Record<string, ReadonlySet<string>> = {
  doc: new Set(),
  paragraph: new Set(['textAlign']),
  text: new Set(),
  heading: new Set(['level', 'textAlign']),
  blockquote: new Set(),
  bulletList: new Set(),
  orderedList: new Set(['start']),
  listItem: new Set(),
  hardBreak: new Set(),
  footnote: new Set(['id']),
  mention: new Set(['userId', 'label']),
  hashtag: new Set(['tag']),
};

interface JsonNode {
  type?: unknown;
  attrs?: unknown;
  content?: unknown;
  marks?: unknown;
  text?: unknown;
}

/** Validates a TipTap document; throws `PIECE_CONTENT_INVALID` on any violation. */
export function sanitizeContent(doc: unknown): void {
  if (!isObject(doc) || doc.type !== 'doc') {
    throw new PieceContentInvalidException('root must be a TipTap "doc" node');
  }
  const counter = { n: 0 };
  walk(doc, 0, counter);
}

function walk(node: JsonNode, depth: number, counter: { n: number }): void {
  if (depth > MAX_DEPTH) {
    throw new PieceContentInvalidException(`nesting exceeds ${MAX_DEPTH} levels`);
  }
  if (++counter.n > MAX_NODES) {
    throw new PieceContentInvalidException(`document exceeds ${MAX_NODES} nodes`);
  }

  const type = node.type;
  if (typeof type !== 'string' || !(type in NODE_ATTRS)) {
    throw new PieceContentInvalidException(`node type "${String(type)}" is not allowed`);
  }

  validateAttrs(type, node.attrs);
  validateMarks(node.marks);

  if (node.content !== undefined) {
    if (!Array.isArray(node.content)) {
      throw new PieceContentInvalidException(`"${type}.content" must be an array`);
    }
    for (const child of node.content) {
      if (!isObject(child)) {
        throw new PieceContentInvalidException('content entries must be nodes');
      }
      walk(child, depth + 1, counter);
    }
  }
}

function validateAttrs(type: string, attrs: unknown): void {
  if (attrs === undefined || attrs === null) {
    return;
  }
  if (!isObject(attrs)) {
    throw new PieceContentInvalidException(`"${type}.attrs" must be an object`);
  }
  const allowed = NODE_ATTRS[type] ?? new Set<string>();
  for (const key of Object.keys(attrs)) {
    if (!allowed.has(key)) {
      throw new PieceContentInvalidException(`attribute "${type}.${key}" is not allowed`);
    }
  }
  if (type === 'paragraph' || type === 'heading') {
    const align = (attrs as { textAlign?: unknown }).textAlign;
    if (align !== undefined && align !== null && !ALLOWED_ALIGN.has(String(align))) {
      throw new PieceContentInvalidException(`invalid textAlign "${String(align)}"`);
    }
  }
  if (type === 'heading') {
    const level = (attrs as { level?: unknown }).level;
    if (typeof level !== 'number' || level < 2 || level > 4) {
      throw new PieceContentInvalidException('heading level must be 2–4');
    }
  }
}

function validateMarks(marks: unknown): void {
  if (marks === undefined) {
    return;
  }
  if (!Array.isArray(marks)) {
    throw new PieceContentInvalidException('marks must be an array');
  }
  for (const mark of marks) {
    if (!isObject(mark) || typeof mark.type !== 'string' || !ALLOWED_MARKS.has(mark.type)) {
      throw new PieceContentInvalidException(
        `mark "${String((mark as JsonNode).type)}" is not allowed`,
      );
    }
  }
}

function isObject(value: unknown): value is JsonNode {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
