import { describe, expect, it } from 'vitest';

import { appendSuffix, slugify } from './slugify.js';

// slugify normalizes to NFKD, so expected literals are normalized the same
// way — otherwise composed source-code literals would fail comparison.
const nfkd = (s: string): string => s.normalize('NFKD');

describe('slugify', () => {
  it('slugifies basic latin with punctuation', () => {
    expect(slugify('Hello, World!')).toBe('hello-world');
  });

  it('lowercases and trims', () => {
    expect(slugify('  My First PIECE  ')).toBe('my-first-piece');
  });

  it('collapses runs of whitespace and punctuation into one hyphen', () => {
    expect(slugify('a  —  b ... c')).toBe('a-b-c');
  });

  it('keeps latin diacritics via NFKD (marks are preserved, not stripped)', () => {
    expect(slugify('Crème Brûlée')).toBe(nfkd('crème-brûlée'));
  });

  it('slugifies Hindi (Devanagari) titles, preserving matras', () => {
    expect(slugify('मेरी पहली कविता')).toBe(nfkd('मेरी-पहली-कविता'));
  });

  it('slugifies Devanagari with nukta and digits', () => {
    expect(slugify('ग़ज़ल 101!')).toBe(nfkd('ग़ज़ल-101'));
  });

  it('slugifies Urdu (Arabic script) titles', () => {
    expect(slugify('میری پہلی نظم')).toBe(nfkd('میری-پہلی-نظم'));
  });

  it('handles mixed-script input', () => {
    expect(slugify('Qalam — क़लम — قلم')).toBe(nfkd('qalam-क़लम-قلم'));
  });

  it('returns empty string for empty or symbol-only input', () => {
    expect(slugify('')).toBe('');
    expect(slugify('!!! --- ***')).toBe('');
  });

  it('truncates to maxLength without a trailing hyphen', () => {
    const result = slugify('word '.repeat(50), { maxLength: 12 });
    expect(Array.from(result).length).toBeLessThanOrEqual(12);
    expect(result).toBe('word-word-wo');
    expect(result.endsWith('-')).toBe(false);
  });

  it('defaults maxLength to 80 code points', () => {
    const result = slugify('a'.repeat(300));
    expect(Array.from(result).length).toBe(80);
  });
});

describe('appendSuffix', () => {
  it('joins slug and suffix with a hyphen', () => {
    expect(appendSuffix('my-piece', 'x1y2z3')).toBe('my-piece-x1y2z3');
  });

  it('trims the base so the result stays within maxLength', () => {
    const result = appendSuffix('a'.repeat(100), 'abc123');
    expect(Array.from(result).length).toBeLessThanOrEqual(80);
    expect(result.endsWith('-abc123')).toBe(true);
  });

  it('never produces a double hyphen at the join', () => {
    const result = appendSuffix('ends-with-hyphen-', 'zz9', 12);
    expect(result).not.toContain('--');
    expect(result.endsWith('-zz9')).toBe(true);
  });

  it('works with unicode bases', () => {
    const result = appendSuffix(slugify('मेरी पहली कविता'), 'q1w2e3');
    expect(result.endsWith('-q1w2e3')).toBe(true);
  });
});
