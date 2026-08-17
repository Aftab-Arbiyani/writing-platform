/**
 * Public surface of the Users feature (A4) — the `/users` route renders `UsersPage`, and the
 * `/trust` route renders `UserTrustPage`.
 *
 * Trust lives in this feature rather than one of its own because the surface has a single owner and
 * two entry points (a tab on the user detail drawer, plus the standalone route for the moderator who
 * cannot reach `/users`). A `features/trust/` would have to be imported sideways by the drawer,
 * which `features/README.md` forbids — see `components/trust-panel.tsx`.
 */
export { UsersPage } from './pages/users-page';
export { UserTrustPage } from './pages/user-trust-page';
