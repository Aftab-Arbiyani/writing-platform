import type { TipTapNode } from '../types/reading.types';

/**
 * Per-block character offsets in the server's **`anchorText` coordinate space** — the projection a
 * suggestion's `anchor.{from,to}` indexes into (C-15, docs/48 §3.22a).
 *
 * That space is every `type: 'text'` leaf of the raw document concatenated **verbatim with no
 * separator anywhere** — not between text runs and not between blocks
 * (`backend/src/modules/collaboration/content-text.util.ts`). It is deliberately NOT
 * `@qalam/utils` `extractPlainText`, which joins with `' '` and collapses whitespace: for
 * `{p:"first"}{p:"second"}` those are `"firstsecond"` (11) and `"first second"` (12), so every
 * block boundary shifts every later offset by one. `content-text.divergence.spec.ts` pins that
 * difference on the server side; this module is the client half of the same contract.
 *
 * It is also NOT the string the reader displays. {@link ContentRenderer} emits synthetic
 * characters a mention/hashtag/footnote never contributed to `anchorText` — `@label`, `#tag`, the
 * footnote marker, a `<br>` — so measuring rendered text would overcount every later offset.
 *
 * ## Why this is a port, not a new design
 *
 * Mobile shipped this half on 2026-08-21 and it was **live-verified against a running backend on
 * 2026-08-25** (docs/48, eleventh reconciliation): its coordinate space came out byte-identical to
 * the server's over a document carrying every reachable hazard, five computed anchors were accepted
 * `200` with the rewrite landing on the right passage, and two deliberate off-by-N controls both
 * `409 SUGGESTION_CONFLICT` — so the exactness is proven rather than assumed. This file is a direct
 * port of `qalam-mobile/lib/features/reading/domain/content_parser.dart`
 * (`parseContentWithAnchors`), and it must stay one: the offset-exact check on accept means any
 * divergence between the two clients is a 409 for one platform's users only.
 *
 * The granularity is **whole-block**, which was an owner decision on 2026-08-21 and not a
 * limitation of this walker: a reader proposes an edit to a whole paragraph or heading, because
 * neither client has drag-select infrastructure anywhere (comments have the identical gap).
 */
export interface BlockAnchor {
  /** Inclusive start offset in `anchorText` space. */
  readonly from: number;
  /** Exclusive end offset. `to - from === text.length`. */
  readonly to: number;
  /** The block's own text, exactly as it exists in `anchorText` — the server's `originalText`. */
  readonly text: string;
}

/**
 * Walks `doc` and returns an anchor for every non-empty `paragraph` / `heading`, keyed by the node
 * object itself so a renderer walking the same document can look its own node up.
 *
 * Identity keying (rather than an index path) is what mobile does and is the property worth
 * keeping: "which blocks are selectable" and "what offset does each one have" come out of a single
 * pass, so the two can never disagree. A second, independently-filtered walk over a rendered tree
 * is exactly how they would drift.
 *
 * An **empty** block gets no entry and contributes nothing — offering to rewrite a blank paragraph
 * is a broken-looking affordance for no benefit.
 *
 * A node type this client does not model still has its raw `content` walked so the running cursor
 * advances by whatever text leaves it contains, even though nothing selectable comes out of it.
 * This mirrors the server's walk, which knows nothing of a whitelist. Skipping unknown nodes — the
 * right thing for *rendering*, which is why {@link ContentRenderer} does exactly that — would
 * undercount every later offset the day a node type ships that this client has not been taught.
 * Today that is unreachable (the sanitizer's allowlist holds nothing this walker mishandles, so
 * `POST /pieces` refuses an unknown type before it can be stored), which makes the behaviour pure
 * forward-compatibility: cheap, and load-bearing on exactly one future day.
 */
export function buildBlockAnchors(
  doc: TipTapNode | null | undefined,
): Map<TipTapNode, BlockAnchor> {
  const anchors = new Map<TipTapNode, BlockAnchor>();
  if (doc === null || doc === undefined) {
    return anchors;
  }
  walkBlocks(childrenOf(doc), 0, anchors);
  return anchors;
}

/** Walks a sibling list, returning the total `anchorText` length it consumed. */
function walkBlocks(
  nodes: readonly TipTapNode[],
  from: number,
  anchors: Map<TipTapNode, BlockAnchor>,
): number {
  let cursor = from;
  for (const node of nodes) {
    cursor += walkBlock(node, cursor, anchors);
  }
  return cursor - from;
}

function walkBlock(node: TipTapNode, from: number, anchors: Map<TipTapNode, BlockAnchor>): number {
  if (node === null || typeof node !== 'object') {
    return 0;
  }
  switch (node.type) {
    case 'paragraph':
    case 'heading':
      return recordAnchor(node, from, anchors);

    // A container contributes only what its children do, and its children are the selectable
    // blocks — a blockquote's paragraphs and a list item's paragraphs each get their own anchor.
    case 'blockquote':
    case 'bulletList':
    case 'orderedList':
    case 'listItem':
      return walkBlocks(childrenOf(node), from, anchors);

    default:
      return rawTextLength(node);
  }
}

/**
 * Records a paragraph/heading's anchor and returns its length.
 *
 * The text is the concatenation of this block's **direct `text` leaf children only**. Inline atoms
 * — mention, hashtag, footnote, hardBreak — carry no `text` leaf, so they contribute zero here,
 * which is precisely what the server's projection does with them.
 */
function recordAnchor(
  node: TipTapNode,
  from: number,
  anchors: Map<TipTapNode, BlockAnchor>,
): number {
  let text = '';
  for (const child of childrenOf(node)) {
    if (child.type === 'text' && typeof child.text === 'string') {
      text += child.text;
    }
  }
  if (text.length > 0) {
    anchors.set(node, { from, to: from + text.length, text });
  }
  return text.length;
}

/**
 * Total length of every `type: 'text'` leaf inside `node`, at any depth — the server's own walk,
 * which does not consult a whitelist.
 */
function rawTextLength(node: TipTapNode | null | undefined): number {
  if (node === null || node === undefined || typeof node !== 'object') {
    return 0;
  }
  let length = node.type === 'text' && typeof node.text === 'string' ? node.text.length : 0;
  for (const child of childrenOf(node)) {
    length += rawTextLength(child);
  }
  return length;
}

function childrenOf(node: TipTapNode | null | undefined): readonly TipTapNode[] {
  return Array.isArray(node?.content) ? node.content : [];
}
