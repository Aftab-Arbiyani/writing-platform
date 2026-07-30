import { PieceContentInvalidException } from '../exceptions/pieces.exceptions';
import { sanitizeContent } from './content-sanitizer';

const doc = (content: unknown[]): unknown => ({ type: 'doc', content });

describe('sanitizeContent (docs 13 §5.2 whitelist)', () => {
  it('accepts a valid document with allowed nodes and marks', () => {
    const valid = doc([
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Title' }] },
      {
        type: 'paragraph',
        attrs: { textAlign: 'right' },
        content: [{ type: 'text', text: 'bold', marks: [{ type: 'bold' }] }],
      },
      { type: 'footnote', attrs: { id: 'f1' }, content: [{ type: 'text', text: 'note' }] },
    ]);
    expect(() => sanitizeContent(valid)).not.toThrow();
  });

  it('rejects a document whose root is not a doc node', () => {
    expect(() => sanitizeContent({ type: 'paragraph' })).toThrow(PieceContentInvalidException);
  });

  it('rejects an unknown node type', () => {
    expect(() => sanitizeContent(doc([{ type: 'iframe' }]))).toThrow(PieceContentInvalidException);
  });

  it('rejects an unknown mark (e.g. link — XSS-prone, not in the editor)', () => {
    const bad = doc([
      {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: 'x',
            marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }],
          },
        ],
      },
    ]);
    expect(() => sanitizeContent(bad)).toThrow(PieceContentInvalidException);
  });

  it('rejects a non-whitelisted attribute (e.g. style/class)', () => {
    expect(() =>
      sanitizeContent(doc([{ type: 'paragraph', attrs: { style: 'color:red' } }])),
    ).toThrow(PieceContentInvalidException);
  });

  it('rejects an invalid heading level and invalid alignment', () => {
    expect(() => sanitizeContent(doc([{ type: 'heading', attrs: { level: 1 } }]))).toThrow(
      PieceContentInvalidException,
    );
    expect(() =>
      sanitizeContent(doc([{ type: 'paragraph', attrs: { textAlign: 'sideways' } }])),
    ).toThrow(PieceContentInvalidException);
  });

  it('rejects pathologically deep nesting', () => {
    let node: unknown = { type: 'text', text: 'deep' };
    for (let i = 0; i < 40; i++) {
      node = { type: 'blockquote', content: [node] };
    }
    expect(() => sanitizeContent(doc([node]))).toThrow(PieceContentInvalidException);
  });
});
