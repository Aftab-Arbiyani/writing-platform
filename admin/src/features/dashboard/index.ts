/**
 * Public surface of the dashboard feature (docs/03 §5). The lazy route module renders `DashboardPage`.
 * Reusable presentational primitives live in shared `src/components`; this feature owns the data
 * wiring (widgets + hooks + api). Deletable with one `rm -rf`.
 */
export { DashboardPage } from './pages/dashboard-page';
