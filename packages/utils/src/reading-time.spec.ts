import { describe, expect, it } from 'vitest';

import { countWords, readingTime } from './reading-time.js';

describe('countWords', () => {
  it('returns 0 for empty and whitespace-only input', () => {
    expect(countWords('')).toBe(0);
    expect(countWords('   \n\t  ')).toBe(0);
  });

  it('counts space-separated latin words', () => {
    expect(countWords('Hello world')).toBe(2);
    expect(countWords('one two three four')).toBe(4);
  });

  it('ignores punctuation-only tokens', () => {
    expect(countWords('Hello — world !!')).toBe(2);
  });

  it('counts Hindi (Devanagari) words', () => {
    expect(countWords('मेरी पहली कविता आज प्रकाशित हुई')).toBe(6);
  });

  it('counts Urdu (Arabic script) words', () => {
    expect(countWords('میری پہلی نظم')).toBe(3);
  });

  it('counts words across newlines', () => {
    expect(countWords('पहली पंक्ति\nदوسری line')).toBe(4);
  });

  it('counts each CJK character as one word', () => {
    expect(countWords('日本語テスト')).toBe(6);
  });

  it('handles mixed CJK and spaced text', () => {
    // 2 Han chars + 2 latin words.
    expect(countWords('中文 and English')).toBe(4);
  });
});

describe('readingTime', () => {
  it('returns seconds at the default 200 wpm', () => {
    expect(readingTime(200)).toBe(60);
    expect(readingTime(100)).toBe(30);
    expect(readingTime(400)).toBe(120);
  });

  it('rounds up to the next whole second', () => {
    expect(readingTime(1)).toBe(1); // 0.3s -> 1s
    expect(readingTime(201)).toBe(61);
  });

  it('respects a custom wpm', () => {
    expect(readingTime(50, 100)).toBe(30);
  });

  it('returns 0 for zero or negative word counts', () => {
    expect(readingTime(0)).toBe(0);
    expect(readingTime(-5)).toBe(0);
  });

  it('returns 0 for a non-positive wpm instead of dividing by zero', () => {
    expect(readingTime(100, 0)).toBe(0);
  });
});
