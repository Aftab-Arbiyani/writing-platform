/**
 * Public surface of the System / Ops feature (P7.1). The lazy route modules render these pages;
 * data wiring (api + hooks + types) lives inside the slice. Deletable with one `rm -rf`.
 */
export { SystemInfoPage } from './pages/system-info-page';
export { ConfigHealthPage } from './pages/config-health-page';
export { InfrastructureHealthPage } from './pages/infrastructure-health-page';
