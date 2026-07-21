/**
 * Public surface of the Operations feature (P7.4). The lazy route modules render these pages; the
 * data wiring (api + hooks + types) and presentational vocabulary live inside the slice. Deletable
 * with one `rm -rf`.
 */
export { OperationsDashboardPage } from './pages/operations-dashboard-page';
export { IncidentDashboardPage } from './pages/incident-dashboard-page';
export { AlertDashboardPage } from './pages/alert-dashboard-page';
export { TracingViewerPage } from './pages/tracing-viewer-page';
export { MetricsViewerPage } from './pages/metrics-viewer-page';
export { LogViewerPage } from './pages/log-viewer-page';
export { DeploymentViewerPage } from './pages/deployment-viewer-page';
export { CostDashboardPage } from './pages/cost-dashboard-page';
export { SloDashboardPage } from './pages/slo-dashboard-page';
export { ServiceStatusDashboardPage } from './pages/service-status-dashboard-page';
