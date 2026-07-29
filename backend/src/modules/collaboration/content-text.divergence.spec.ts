import { extractPlainText } from '@qalam/utils';

import { anchorText, replaceTextRange } from './content-text.util';

/**
 * The platform flattens a TipTap document to a string in TWO places, on purpose:
 *
 * - `@qalam/utils` `extractPlainText` — FTS input, word count, reading time. It puts a
 *   space between text nodes and collapses/trims, so words at block boundaries do not
 *   fuse for a human reader or a search index.
 * - `anchorText` (collaboration) — the coordinate space suggestion anchors index into.
 *   Verbatim concatenation, no separator.
 *
 * They must NOT be unified. This file pins the difference so that:
 *
 * 1. Nobody "deduplicates" them — that would silently move every stored anchor, and an
 *    accept would then rewrite the wrong passage (or refuse a valid one with 409).
 * 2. A change to EITHER implementation fails here rather than in production, because
 *    the two are asserted against each other on the same document.
 */
const TWO_BLOCKS = {
  type: 'doc',
  content: [
    { type: 'paragraph', content: [{ type: 'text', text: 'first' }] },
    { type: 'paragraph', content: [{ type: 'text', text: 'second' }] },
  ],
};

describe('anchorText vs @qalam/utils extractPlainText', () => {
  it('produces different strings for the same document, by design', () => {
    expect(extractPlainText(TWO_BLOCKS)).toBe('first second');
    expect(anchorText(TWO_BLOCKS)).toBe('firstsecond');
  });

  it('drifts by exactly one character per block boundary', () => {
    // Two blocks → one synthetic separator. This is the whole difference, and it is
    // why an offset taken in one projection is meaningless in the other.
    expect(extractPlainText(TWO_BLOCKS).length - anchorText(TWO_BLOCKS).length).toBe(1);
  });

  it('agrees on a single-block document — the difference is separators, nothing else', () => {
    const one = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'one run' }] }],
    };
    expect(anchorText(one)).toBe(extractPlainText(one));
  });

  it('agrees on which nodes are text leaves', () => {
    // A node carrying a `text` string but not typed `text` is not a leaf in either.
    const odd = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'kept' }] },
        { type: 'image', text: 'alt text as a stray key' },
      ],
    };
    expect(anchorText(odd)).toBe('kept');
    expect(extractPlainText(odd)).toBe('kept');
  });

  it('keeps whitespace verbatim, where the utils projection collapses it', () => {
    const spaced = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: '  wide   gap  ' }] }],
    };
    // Anchors must survive whitespace exactly — trimming would shift every offset.
    expect(anchorText(spaced)).toBe('  wide   gap  ');
    expect(extractPlainText(spaced)).toBe('wide gap');
  });

  it('is the projection replaceTextRange writes back into', () => {
    // The round-trip that makes the raw concatenation the only usable anchor space:
    // an offset read from `anchorText` addresses a real character in a real leaf.
    const from = anchorText(TWO_BLOCKS).indexOf('sec');
    const next = replaceTextRange(TWO_BLOCKS, from, from + 3, 'THIRD-');
    expect(anchorText(next)).toBe('firstTHIRD-ond');
  });
});
