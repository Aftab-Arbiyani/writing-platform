import { csvEscape, csvLine } from './csv.util';

describe('csvEscape', () => {
  it('passes through plain values unquoted', () => {
    expect(csvEscape('meera')).toBe('meera');
    expect(csvEscape(42)).toBe('42');
    expect(csvEscape(true)).toBe('true');
  });

  it('renders null/undefined as empty', () => {
    expect(csvEscape(null)).toBe('');
    expect(csvEscape(undefined)).toBe('');
  });

  it('quotes and escapes values containing comma, quote, or newline', () => {
    expect(csvEscape('a,b')).toBe('"a,b"');
    expect(csvEscape('she said "hi"')).toBe('"she said ""hi"""');
    expect(csvEscape('line1\nline2')).toBe('"line1\nline2"');
  });
});

describe('csvLine', () => {
  it('joins escaped cells with commas and a trailing newline', () => {
    expect(csvLine(['a', 'b,c', 3])).toBe('a,"b,c",3\n');
  });
});
