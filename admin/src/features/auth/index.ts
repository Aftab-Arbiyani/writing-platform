/**
 * Public surface of the auth feature (docs/03 §5). Login lives here; the reusable authz primitives
 * (RoleGuard / PermissionGuard / usePermissions) are SHARED (src/components, src/hooks) so other
 * features can gate UI without importing this feature. `bootstrapSession` is consumed by app/providers;
 * `SessionExpiredDialog` is mounted by app/layouts. Deletable with one `rm -rf` (login only).
 */
export { LoginPage } from './pages/login-page';
export { SessionExpiredDialog } from './components/session-expired-dialog';
export { bootstrapSession } from './lib/session';
export { useLogout } from './hooks/use-logout';
