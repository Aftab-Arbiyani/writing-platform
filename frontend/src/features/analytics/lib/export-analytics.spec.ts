import { describe, expect, it } from 'vitest';

import type { ReaderAnalytics, WriterAnalytics } from '../types/analytics.types';
import { readerExportRows, rowsToCsv, toJSON, writerExportRows } from './export-analytics';

describe('rowsToCsv', () => {
  it('renders a Metric,Value header + rows', () => {
    const csv = rowsToCsv([
      { metric: 'Total views', value: 1200 },
      { metric: 'Completion rate', value: '65%' },
    ]);
    expect(csv).toBe('Metric,Value\nTotal views,1200\nCompletion rate,65%\n');
  });

  it('escapes commas, quotes, and newlines', () => {
    const csv = rowsToCsv([{ metric: 'A "big", metric', value: 'x\ny' }]);
    expect(csv).toContain('"A ""big"", metric"');
    expect(csv).toContain('"x\ny"');
  });
});

describe('toJSON', () => {
  it('pretty-prints the payload', () => {
    expect(toJSON({ a: 1 })).toBe('{\n  "a": 1\n}');
  });
});

const WRITER = {
  totalViews: 12_000,
  uniqueViews: 8000,
  reads: 8100,
  completionRate: 0.65,
  totalReadSeconds: 100_000,
  averageReadTimeSeconds: 312,
  followersGained: 214,
  piecesPublished: 12,
  piecesArchived: 0,
  commentsReceived: 40,
  clapsReceived: 900,
  bookmarksReceived: 75,
  responsesReceived: 12,
  mostPopularPiece: null,
} satisfies WriterAnalytics;

const READER = {
  piecesRead: 50,
  readingTimeSeconds: 100_000,
  completedReads: 40,
  currentStreak: 5,
  longestStreak: 12,
  favoriteGenres: [{ key: 'ghazal', label: 'Ghazal', count: 20 }],
  favoriteLanguages: [{ key: 'ur', label: 'اردو', count: 30 }],
} satisfies ReaderAnalytics;

/** W7c split one mixed export in two, one per audience. These assert the split holds. */
describe('writerExportRows', () => {
  it('exports the writer aggregate', () => {
    const metrics = writerExportRows(WRITER, 340).map((r) => r.metric);
    expect(metrics).toContain('Total views');
    expect(metrics).toContain('Followers');
    expect(metrics).toContain('Bookmarks received'); // bookmarks OF the writer's pieces
  });

  it('carries no reader figures', () => {
    const metrics = writerExportRows(WRITER, 340).map((r) => r.metric);
    expect(metrics).not.toContain('Pieces read');
    expect(metrics).not.toContain('Current reading streak (days)');
    expect(metrics).not.toContain('Longest reading streak (days)');
  });

  it('omits the followers row when the identity query has not resolved', () => {
    expect(writerExportRows(WRITER, undefined).map((r) => r.metric)).not.toContain('Followers');
  });
});

describe('readerExportRows', () => {
  it('exports all seven aggregate fields, ranked lists by label', () => {
    const rows = readerExportRows(READER);
    const metrics = rows.map((r) => r.metric);
    expect(metrics).toContain('Pieces read');
    expect(metrics).toContain('Reading time (seconds)');
    expect(metrics).toContain('Completed reads');
    expect(metrics).toContain('Current reading streak (days)');
    expect(metrics).toContain('Longest reading streak (days)');
    expect(metrics).toContain('Genre read — Ghazal');
    expect(metrics).toContain('Language read — اردو');
    // The stable key is never exported as if it were a label.
    expect(metrics).not.toContain('Genre read — ghazal');
  });

  it('carries no writer figures', () => {
    expect(readerExportRows(READER).map((r) => r.metric)).not.toContain('Total views');
  });

  it('labels a bounded bookmarks count as "at least"', () => {
    const rows = readerExportRows(READER, { count: 50, hasMore: true });
    expect(rows).toContainEqual({ metric: 'Bookmarks (at least)', value: 50 });
  });

  it('labels an exact bookmarks count plainly', () => {
    const rows = readerExportRows(READER, { count: 7, hasMore: false });
    expect(rows).toContainEqual({ metric: 'Bookmarks', value: 7 });
  });

  it('omits bookmarks entirely when the count did not load — never exports a fabricated 0', () => {
    const metrics = readerExportRows(READER, undefined).map((r) => r.metric);
    expect(metrics).not.toContain('Bookmarks');
    expect(metrics).not.toContain('Bookmarks (at least)');
  });

  it('exports a new reader’s true zeroes rather than dropping the rows', () => {
    const rows = readerExportRows({
      piecesRead: 0,
      readingTimeSeconds: 0,
      completedReads: 0,
      currentStreak: 0,
      longestStreak: 0,
      favoriteGenres: [],
      favoriteLanguages: [],
    });
    expect(rows).toContainEqual({ metric: 'Pieces read', value: 0 });
    expect(rows).toHaveLength(5);
  });
});
