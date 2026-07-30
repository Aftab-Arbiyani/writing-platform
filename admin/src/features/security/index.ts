/**
 * Public surface of the Security / Compliance / Privacy feature (P7.2). The lazy route modules
 * render these pages; data wiring (api + hooks + types) lives inside the slice. Deletable with one
 * `rm -rf`.
 */
export { SecurityDashboardPage } from './pages/security-dashboard-page';
export { ComplianceDashboardPage } from './pages/compliance-dashboard-page';
export { PrivacyDashboardPage } from './pages/privacy-dashboard-page';
