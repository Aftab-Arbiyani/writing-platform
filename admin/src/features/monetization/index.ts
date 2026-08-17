/**
 * The monetization admin feature (A1) — plan/pricing config, entitlement overrides, the money
 * actions, and the three analytics dashboards, over the shipped `admin/monetization` surface.
 *
 * Only pages are exported: route modules mount them and nothing else may reach inside (a feature is
 * deletable with one `rm -rf`, `features/README.md`). This feature imports no other feature, which
 * is load-bearing here — monetization touches users, analytics and settings, and importing any of
 * them would entangle all three.
 */
export { PlansPage } from './pages/plans-page';
export { EntitlementsPage } from './pages/entitlements-page';
