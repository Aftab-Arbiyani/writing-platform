import { describe, expect, it } from 'vitest';

import { extractPlainText } from './tiptap-text.js';

describe('extractPlainText', () => {
  it('flattens nested TipTap text nodes with block spacing', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Hello' },
            { type: 'text', text: ' world' },
          ],
        },
        { type: 'paragraph', content: [{ type: 'text', text: 'second' }] },
      ],
    };
    expect(extractPlainText(doc)).toBe('Hello world second');
  });

  it('returns empty string for an empty or malformed document', () => {
    expect(extractPlainText({ type: 'doc', content: [] })).toBe('');
    expect(extractPlainText(null)).toBe('');
    expect(extractPlainText('nope')).toBe('');
  });

  it('ignores non-text nodes but keeps their text descendants (e.g. footnotes)', () => {
    const doc = {
      type: 'doc',
      content: [{ type: 'footnote', content: [{ type: 'text', text: 'note text' }] }],
    };
    expect(extractPlainText(doc)).toBe('note text');
  });
});
