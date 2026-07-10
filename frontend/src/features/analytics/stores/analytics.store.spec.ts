import { AnalyticsPeriod } from '@qalam/shared';
import { beforeEach, describe, expect, it } from 'vitest';

import { useAnalyticsStore, windowFor } from './analytics.store';

const reset = (): void => {
  useAnalyticsStore.setState({ range: '30d', metric: 'views', chartStyle: 'area' });
};

describe('useAnalyticsStore', () => {
  beforeEach(reset);

  it('updates the range, metric, and chart style', () => {
    useAnalyticsStore.getState().setRange('90d');
    useAnalyticsStore.getState().setMetric('reads');
    useAnalyticsStore.getState().setChartStyle('line');
    const s = useAnalyticsStore.getState();
    expect(s.range).toBe('90d');
    expect(s.metric).toBe('reads');
    expect(s.chartStyle).toBe('line');
  });

  it('resolves range presets to the API growth window', () => {
    expect(windowFor('7d')).toEqual({ period: AnalyticsPeriod.Daily, points: 7 });
    expect(windowFor('12w')).toEqual({ period: AnalyticsPeriod.Weekly, points: 12 });
    expect(windowFor('12m')).toEqual({ period: AnalyticsPeriod.Monthly, points: 12 });
  });
});
