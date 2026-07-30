import { anchorText, replaceTextRange } from './content-text.util';

/** A doc whose paragraph is built from the given text leaves (one per mark run). */
function doc(...leaves: { text: string; marks?: unknown[] }[]): Record<string, unknown> {
  return {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: leaves.map((leaf) => ({ type: 'text', ...leaf })),
      },
    ],
  };
}

describe('replaceTextRange (suggestion anchors)', () => {
  it('replaces a range inside a single leaf', () => {
    const next = replaceTextRange(doc({ text: 'the original text' }), 4, 12, 'improved');
    expect(anchorText(next)).toBe('the improved text');
  });

  it('leaves the input document untouched', () => {
    const before = doc({ text: 'the original text' });
    replaceTextRange(before, 4, 12, 'improved');
    expect(anchorText(before)).toBe('the original text');
  });

  it('keeps the marks of the leaf the replacement lands in', () => {
    const next = replaceTextRange(
      doc({ text: 'plain ' }, { text: 'bold', marks: [{ type: 'bold' }] }),
      6,
      10,
      'strong',
    );
    const paragraph = (next.content as Record<string, unknown>[])[0]!;
    expect(paragraph.content).toEqual([
      { type: 'text', text: 'plain ' },
      { type: 'text', text: 'strong', marks: [{ type: 'bold' }] },
    ]);
  });

  it('spans leaves — the replacement lands in the first, the rest is removed', () => {
    // Offsets are document-wide, so a range may cross mark runs and blocks.
    const next = replaceTextRange(
      doc({ text: 'one ' }, { text: 'two ', marks: [{ type: 'italic' }] }, { text: 'three' }),
      4,
      12,
      'ONE',
    );
    expect(anchorText(next)).toBe('one ONEe');
  });

  it('drops a leaf left with no text (an empty text node is not a valid node)', () => {
    const next = replaceTextRange(doc({ text: 'keep ' }, { text: 'drop' }), 5, 9, '');
    const paragraph = (next.content as Record<string, unknown>[])[0]!;
    expect(paragraph.content).toEqual([{ type: 'text', text: 'keep ' }]);
  });

  it('inserts at a collapsed range', () => {
    const next = replaceTextRange(doc({ text: 'ab' }), 1, 1, 'X');
    expect(anchorText(next)).toBe('aXb');
  });

  it('inserts at the very end of the document', () => {
    const next = replaceTextRange(doc({ text: 'ab' }), 2, 2, '!');
    expect(anchorText(next)).toBe('ab!');
  });

  it('crosses block boundaries', () => {
    const two: Record<string, unknown> = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'first' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'second' }] },
      ],
    };
    // "stsec" spans the end of paragraph one and the start of paragraph two.
    const next = replaceTextRange(two, 3, 8, '-');
    expect(anchorText(next)).toBe('fir-ond');
  });
});
