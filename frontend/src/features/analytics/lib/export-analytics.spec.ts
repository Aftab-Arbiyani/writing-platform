import { describe, expect, it } from 'vitest';

import { rowsToCsv, toJSON } from './export-analytics';

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
