/**
 * Public surface of the profile feature (docs/26 §4) — the writer profile at `/@:username`, the
 * follow system, and the follow-requests inbox. Imported by the lazy `profile` /
 * `follow-requests` route modules. Follow state lives in this feature's TanStack Query hooks
 * (optimistic); the feature is self-contained and deletable with one `rm -rf`.
 */
export { ProfilePage } from './pages/profile-page';
export { FollowRequestsPage } from './pages/follow-requests-page';
