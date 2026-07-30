import { beforeEach, describe, expect, it } from 'vitest';

import { useDashboardStore } from './dashboard.store';

beforeEach(() => {
  useDashboardStore.setState({
    timeRange: '7d',
    customFrom: null,
    customTo: null,
    collapsedWidgets: [],
  });
});

describe('dashboard.store', () => {
  it('sets the time range', () => {
    useDashboardStore.getState().setTimeRange('30d');
    expect(useDashboardStore.getState().timeRange).toBe('30d');
  });

  it('setCustomRange stores bounds and switches to custom', () => {
    useDashboardStore.getState().setCustomRange('2026-01-01', '2026-02-01');
    const state = useDashboardStore.getState();
    expect(state.timeRange).toBe('custom');
    expect(state.customFrom).toBe('2026-01-01');
    expect(state.customTo).toBe('2026-02-01');
  });

  it('toggles a widget collapsed state on and off', () => {
    useDashboardStore.getState().toggleWidget('system-health');
    expect(useDashboardStore.getState().collapsedWidgets).toContain('system-health');
    useDashboardStore.getState().toggleWidget('system-health');
    expect(useDashboardStore.getState().collapsedWidgets).not.toContain('system-health');
  });
});
