/**
 * Public surface of the notifications feature (docs/26 §4) — the Activity Center page + the
 * notification preferences page (lazy route modules), the top-bar bell (mounted in the shell), and
 * the mobile tab-bar unread badge. Inbox + unread count live in this feature's TanStack Query
 * hooks; only popover open-state + the toast preference live in its Zustand store. Self-contained
 * and deletable with one `rm -rf`.
 */
export { NotificationsPage } from './pages/notifications-page';
export { NotificationPreferencesPage } from './pages/notification-preferences-page';
export { NotificationBell } from './components/notification-bell';
export { NotificationTabBadge } from './components/notification-tab-badge';
