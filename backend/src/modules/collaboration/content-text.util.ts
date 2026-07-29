/**
 * The ANCHOR projection of a TipTap/ProseMirror document (AF6) — the coordinate
 * space a suggestion's `anchor.from`/`anchor.to` index into — plus the write-back
 * that edits it. {@link anchorText} reads it; {@link replaceTextRange} writes it.
 *
 * ## Why this is NOT `@qalam/utils` `extractPlainText`
 *
 * Both flatten a document to a string, and they deliberately produce DIFFERENT
 * strings. They are two projections for two jobs, not a duplicate to consolidate:
 *
 * | | `@qalam/utils` `extractPlainText` | `anchorText` (here) |
 * | --- | --- | --- |
 * | Between text nodes | inserts `' '` | inserts nothing |
 * | Whitespace | collapsed + trimmed | verbatim |
 * | Job | FTS input, word count, reading time (`contentText`) | suggestion anchors |
 *
 * For `{p: "first"}{p: "second"}` that is `"first second"` (12 chars) against
 * `"firstsecond"` (11) — every block boundary shifts every later offset by one.
 *
 * **The raw concatenation is the only one an anchor can use.** Its offsets map
 * one-to-one onto characters that really exist inside text leaves, which is what
 * lets {@link replaceTextRange} find the passage and rewrite it. Under the utils
 * projection an offset can land on a separator no leaf contains, so an anchor
 * could name a character there is nothing to replace.
 *
 * So: **do not unify these two.** Changing either one silently moves every stored
 * anchor. `content-text.divergence.spec.ts` pins the difference with a worked
 * example and fails if either side moves.
 */

interface RichTextNode {
  type?: string;
  text?: string;
  content?: RichTextNode[];
}

/**
 * A text leaf. Both the read and the write use this one predicate — if they ever
 * disagreed about what counts as text, offsets and edits would address different
 * documents. Matches `@qalam/utils`: `type: 'text'` with a string `text`.
 */
function isTextLeaf(node: RichTextNode): boolean {
  return node.type === 'text' && typeof node.text === 'string';
}

/**
 * Concatenates every text leaf, verbatim and with no separator — the coordinate
 * space suggestion anchors are expressed in. See the file header before reaching
 * for `@qalam/utils` `extractPlainText` instead; they are not interchangeable.
 */
export function anchorText(doc: unknown): string {
  const parts: string[] = [];
  walk(doc as RichTextNode, parts);
  return parts.join('');
}

function walk(node: RichTextNode | null | undefined, out: string[]): void {
  if (node === null || node === undefined || typeof node !== 'object') {
    return;
  }
  if (isTextLeaf(node)) {
    out.push(node.text as string);
  }
  if (Array.isArray(node.content)) {
    for (const child of node.content) {
      walk(child, out);
    }
  }
}

/**
 * Returns a copy of `doc` with the {@link anchorText} range `[from, to)` replaced
 * by `replacement`. The caller must have verified the range against
 * {@link anchorText} first — this function trusts the offsets.
 *
 * The replacement lands in the first text leaf the range touches (keeping that
 * leaf's marks) and the remainder of the range is removed from the following
 * leaves; a leaf left with no text is dropped, since an empty text node is not a
 * valid document node. Everything else — node types, attrs, marks, structure —
 * is preserved untouched.
 */
export function replaceTextRange(
  doc: Record<string, unknown>,
  from: number,
  to: number,
  replacement: string,
): Record<string, unknown> {
  const clone = structuredClone(doc);
  splice(clone as RichTextNode, { from, to, replacement, at: 0, inserted: false });
  return clone;
}

interface SpliceState {
  readonly from: number;
  readonly to: number;
  readonly replacement: string;
  /** Running anchor offset of the next leaf to be visited. */
  at: number;
  /** Whether `replacement` has already been written into a leaf. */
  inserted: boolean;
}

function splice(node: RichTextNode | null | undefined, state: SpliceState): void {
  if (node === null || node === undefined || typeof node !== 'object') {
    return;
  }
  if (isTextLeaf(node)) {
    node.text = rewriteLeaf(node.text as string, state);
    return;
  }
  if (!Array.isArray(node.content)) {
    return;
  }
  for (const child of node.content) {
    splice(child, state);
  }
  node.content = node.content.filter((child) => !(isTextLeaf(child) && child.text === ''));
}

/** Applies the overlap of the range with one text leaf, advancing the cursor. */
function rewriteLeaf(text: string, state: SpliceState): string {
  const start = state.at;
  const end = start + text.length;
  state.at = end;

  // A range with width overlaps only leaves it covers a character of, so a range
  // starting exactly where a leaf ends belongs to the NEXT leaf — otherwise the
  // replacement would inherit the preceding run's marks. A collapsed range (a pure
  // insertion) has no character to cover, so it sits on the first boundary it fits.
  const overlaps =
    state.from === state.to
      ? state.from >= start && state.from <= end
      : state.from < end && state.to > start;
  if (!overlaps) {
    return text;
  }

  const head = text.slice(0, Math.max(state.from, start) - start);
  const tail = text.slice(Math.min(state.to, end) - start);
  if (state.inserted) {
    return head + tail;
  }
  state.inserted = true;
  return head + state.replacement + tail;
}
