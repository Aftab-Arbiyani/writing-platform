/**
 * Public surface of the analytics feature (docs/26 §4) — the Writer Analytics dashboard + the
 * per-piece detail (lazy route modules) and `prefetchDashboard` for warming the overview. All
 * numbers live in this feature's TanStack Query hooks; only date-range + chart preferences live in
 * its Zustand store. ECharts is code-split (loaded on demand). Deletable with one `rm -rf`.
 */
export { AnalyticsDashboardPage } from './pages/analytics-dashboard-page';
export { PieceAnalyticsPage } from './pages/piece-analytics-page';
export { prefetchDashboard } from './hooks/use-dashboard';
