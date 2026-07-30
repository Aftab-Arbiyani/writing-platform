import { describe, expect, it } from 'vitest';

import { parseCoachReport } from './coach-report';

const FULL = {
  score: 78,
  summary: 'A strong opening that loses its grip in the middle.',
  strengths: ['Vivid opening image.', 'Confident dialogue.'],
  weaknesses: ['The middle sags.'],
  suggestions: ['Cut the second paragraph.'],
  recommendations: ['Re-read for pacing.'],
  sections: [{ title: 'Voice', detail: 'Consistent and assured.' }],
};

describe('parseCoachReport', () => {
  it('parses a well-formed report', () => {
    const report = parseCoachReport(JSON.stringify(FULL));
    expect(report).toEqual(FULL);
  });

  it('recovers JSON wrapped in a code fence', () => {
    // The prompts ask for bare JSON, but models fence it anyway — that must not lose the report.
    const raw = '```json\n' + JSON.stringify(FULL) + '\n```';
    expect(parseCoachReport(raw)?.score).toBe(78);
  });

  it('recovers JSON with prose before and after it', () => {
    const raw = `Here is my review:\n${JSON.stringify(FULL)}\nHope that helps!`;
    expect(parseCoachReport(raw)?.summary).toBe(FULL.summary);
  });

  it('clamps the score into 0–100 and rounds it', () => {
    expect(parseCoachReport(JSON.stringify({ ...FULL, score: 140 }))?.score).toBe(100);
    expect(parseCoachReport(JSON.stringify({ ...FULL, score: -5 }))?.score).toBe(0);
    expect(parseCoachReport(JSON.stringify({ ...FULL, score: 61.7 }))?.score).toBe(62);
    expect(parseCoachReport(JSON.stringify({ ...FULL, score: 'nonsense' }))?.score).toBe(0);
  });

  it('drops non-string list entries and blank strings rather than rendering them', () => {
    const raw = JSON.stringify({ ...FULL, strengths: ['keep', '', '   ', 42, null, 'also keep'] });
    expect(parseCoachReport(raw)?.strengths).toEqual(['keep', 'also keep']);
  });

  it('titles an untitled section rather than dropping its detail', () => {
    const raw = JSON.stringify({
      ...FULL,
      sections: [{ detail: 'Detail with no title.' }, { title: '', detail: '' }],
    });
    expect(parseCoachReport(raw)?.sections).toEqual([
      { title: 'Note', detail: 'Detail with no title.' },
    ]);
  });

  it('tolerates missing fields, filling them with empties', () => {
    const report = parseCoachReport(JSON.stringify({ summary: 'Just a summary.' }));
    expect(report).toEqual({
      score: 0,
      summary: 'Just a summary.',
      strengths: [],
      weaknesses: [],
      suggestions: [],
      recommendations: [],
      sections: [],
    });
  });

  it('returns null when there is no JSON at all — the caller shows the raw text', () => {
    expect(parseCoachReport('I could not review that.')).toBeNull();
    expect(parseCoachReport('')).toBeNull();
  });

  it('returns null on malformed JSON rather than throwing', () => {
    expect(parseCoachReport('{"score": 80, "summary": ')).toBeNull();
  });

  it('returns null for a parsed object that carries nothing', () => {
    // Shape-valid but contentless is not a report — fall back to the raw text.
    expect(parseCoachReport(JSON.stringify({ score: 50, summary: '', strengths: [] }))).toBeNull();
  });

  it('returns null for a JSON array', () => {
    expect(parseCoachReport('[1, 2, 3]')).toBeNull();
  });
});
