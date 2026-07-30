/**
 * Public surface of the writing feature — the editor + dashboard pages, imported by the lazy
 * `write` / `drafts` route modules. TipTap lives behind the editor page, so the editor route's
 * lazy chunk is the only place it loads (docs perf: lazy-load + code-split the editor).
 */
export { EditorPage } from './pages/editor-page';
export { DashboardPage } from './pages/dashboard-page';
