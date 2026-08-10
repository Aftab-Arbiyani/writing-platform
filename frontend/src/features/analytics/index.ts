/**
 * Public surface of the analytics feature (docs/26 §4) — THREE lazy route modules and
 * `prefetchDashboard` for warming the overview. All numbers live in this feature's TanStack Query
 * hooks; only date-range + chart preferences live in its Zustand store. ECharts is code-split
 * (loaded on demand). Deletable with one `rm -rf`.
 *
 * The feature serves two audiences and keeps them apart (W7c):
 *   • `AnalyticsDashboardPage` + `PieceAnalyticsPage` — the WRITER (`/me/stats`): reach, growth,
 *     per-piece performance.
 *   • `ReadingStatsPage` — the READER (`/me/reading`): their own reading habits.
 */
export { AnalyticsDashboardPage } from './pages/analytics-dashboard-page';
export { PieceAnalyticsPage } from './pages/piece-analytics-page';
export { ReadingStatsPage } from './pages/reading-stats-page';
export { prefetchDashboard } from './hooks/use-dashboard';
