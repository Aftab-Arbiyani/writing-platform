import { describe, expect, it } from 'vitest';

import type { TipTapNode } from '../types/reading.types';
import { buildBlockAnchors } from './content-anchors';

/**
 * The SERVER's projection, reimplemented here in full (six lines, and that is the point).
 *
 * This is deliberately a second independent implementation rather than an import: the frontend
 * cannot import from `backend/src`, and asserting against a copy of the walker under test would
 * only restate it. Compare with `backend/src/modules/collaboration/content-text.util.ts`
 * `anchorText` — every `type: 'text'` leaf, concatenated verbatim, no separator, no whitelist.
 *
 * If that server function ever changes, this must change with it, and every test below fails until
 * it does — which is the alarm this file exists to be.
 *
 * **This reimplementation was verified against the real util, not assumed faithful** (2026-08-31):
 * the hazard fixture below was run through the actual `anchorText` import inside the backend's own
 * jest, and all six slices matched — `[0,11)` `Chapter one`, `[11,29)` `Hello  and  — see.`,
 * `[29,40)` `beforeafter`, `[40,51)` `quoted line`, `[51,54)` `one`, `[54,57)` `two`, total length
 * **57**. Those are the numbers asserted below, so a divergence shows up here as a failure rather
 * than as a 409 in production.
 */
function referenceAnchorText(node: TipTapNode | null | undefined): string {
  if (node === null || node === undefined || typeof node !== 'object') return '';
  const own = node.type === 'text' && typeof node.text === 'string' ? node.text : '';
  const children = Array.isArray(node.content) ? node.content : [];
  return own + children.map(referenceAnchorText).join('');
}

/** Asserts the property the server enforces on accept: the anchor addresses exactly its own text. */
function expectAnchorsAddressTheirText(doc: TipTapNode): void {
  const text = referenceAnchorText(doc);
  const anchors = buildBlockAnchors(doc);
  expect(anchors.size).toBeGreaterThan(0);
  for (const anchor of anchors.values()) {
    expect(text.slice(anchor.from, anchor.to)).toBe(anchor.text);
    expect(anchor.to - anchor.from).toBe(anchor.text.length);
  }
}

const text = (value: string): TipTapNode => ({ type: 'text', text: value });
const para = (...content: TipTapNode[]): TipTapNode => ({ type: 'paragraph', content });
const doc = (...content: TipTapNode[]): TipTapNode => ({ type: 'doc', content });

describe('buildBlockAnchors', () => {
  it('concatenates blocks with NO separator, unlike extractPlainText', () => {
    const piece = doc(para(text('first')), para(text('second')));
    const anchors = [...buildBlockAnchors(piece).values()];

    // `extractPlainText` would give "first second" (12) and put `second` at 6. An anchor built on
    // that projection names a character no text leaf contains.
    expect(referenceAnchorText(piece)).toBe('firstsecond');
    expect(anchors).toEqual([
      { from: 0, to: 5, text: 'first' },
      { from: 5, to: 11, text: 'second' },
    ]);
  });

  it('agrees with the server across every hazard reachable through the API', () => {
    // The sanitizer's whole allowlist in one document — the shape mobile's live-verified run used.
    const piece = doc(
      { type: 'heading', attrs: { level: 2 }, content: [text('Chapter one')] },
      para(
        text('Hello '),
        { type: 'mention', attrs: { userId: 'u1', label: 'ada' } },
        text(' and '),
        { type: 'hashtag', attrs: { tag: 'craft' } },
        text(' — see'),
        { type: 'footnote', attrs: { id: '1' } },
        text('.'),
      ),
      para(text('before'), { type: 'hardBreak' }, text('after')),
      { type: 'blockquote', content: [para(text('quoted line'))] },
      {
        type: 'bulletList',
        content: [
          { type: 'listItem', content: [para(text('one'))] },
          { type: 'listItem', content: [para(text('two'))] },
        ],
      },
    );

    expectAnchorsAddressTheirText(piece);

    // The inline atoms contribute NOTHING, which is the trap: the reader displays `@ada`, `#craft`
    // and a footnote marker, so measuring rendered text would overcount by 11 here and push every
    // later block's offset out of range.
    const anchors = [...buildBlockAnchors(piece).values()];
    expect(anchors.map((a) => a.text)).toEqual([
      'Chapter one',
      'Hello  and  — see.',
      'beforeafter',
      'quoted line',
      'one',
      'two',
    ]);
    expect(anchors.at(-1)).toEqual({ from: 54, to: 57, text: 'two' });
  });

  it('gives a nested paragraph its own anchor, inside a blockquote and a list item', () => {
    const piece = doc(
      { type: 'blockquote', content: [para(text('aa')), para(text('bb'))] },
      { type: 'orderedList', content: [{ type: 'listItem', content: [para(text('cc'))] }] },
    );
    expect([...buildBlockAnchors(piece).values()]).toEqual([
      { from: 0, to: 2, text: 'aa' },
      { from: 2, to: 4, text: 'bb' },
      { from: 4, to: 6, text: 'cc' },
    ]);
  });

  it('keeps whitespace verbatim rather than collapsing it', () => {
    const piece = doc(para(text('  wide   gap  ')));
    expect([...buildBlockAnchors(piece).values()]).toEqual([
      { from: 0, to: 14, text: '  wide   gap  ' },
    ]);
  });

  it('skips an empty block without shifting the blocks after it', () => {
    const piece = doc(para(), para(text('kept')), { type: 'paragraph', content: [text('')] });
    const anchors = [...buildBlockAnchors(piece).values()];
    expect(anchors).toEqual([{ from: 0, to: 4, text: 'kept' }]);
    expect(referenceAnchorText(piece)).toBe('kept');
  });

  it('still ADVANCES past an unmodelled node type instead of skipping it', () => {
    // The direct regression case for the trap mobile's design pass caught: an unknown block is not
    // selectable, but its text exists in the server's space, so every later offset depends on it
    // being counted. Unreachable through `POST /pieces` today (the sanitizer refuses it) — this is
    // forward-compatibility for the day a node type is added to that allowlist.
    const piece = doc({ type: 'someFutureBlock', content: [text('12345')] }, para(text('after')));

    expectAnchorsAddressTheirText(piece);
    expect([...buildBlockAnchors(piece).values()]).toEqual([{ from: 5, to: 10, text: 'after' }]);
  });

  it('counts a stray non-listItem child of a list, where mobile skips it', () => {
    // A DELIBERATE divergence from `content_parser.dart`, which `continue`s past any child of a
    // list that is not a `listItem` and therefore contributes zero for it. The server has no such
    // filter, so counting matches the coordinate space that actually decides accept/409.
    // Unreachable today — the schema requires list children to be `listItem` — so both clients are
    // correct in practice and this one degrades more safely.
    const piece = doc({ type: 'bulletList', content: [para(text('stray'))] }, para(text('next')));

    expectAnchorsAddressTheirText(piece);
    expect([...buildBlockAnchors(piece).values()]).toEqual([
      { from: 0, to: 5, text: 'stray' },
      { from: 5, to: 9, text: 'next' },
    ]);
  });

  it('is keyed by node identity so a renderer can look its own node up', () => {
    const target = para(text('findable'));
    const piece = doc(para(text('x')), target);
    expect(buildBlockAnchors(piece).get(target)).toEqual({ from: 1, to: 9, text: 'findable' });
  });

  it('returns an empty map for a null, empty or textless document', () => {
    expect(buildBlockAnchors(null).size).toBe(0);
    expect(buildBlockAnchors(undefined).size).toBe(0);
    expect(buildBlockAnchors(doc()).size).toBe(0);
    expect(buildBlockAnchors(doc({ type: 'horizontalRule' })).size).toBe(0);
  });
});
