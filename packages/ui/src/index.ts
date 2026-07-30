/**
 * @qalam/ui — design tokens, AntD theme factory, and shared presentational primitives.
 * Motion variants + MotionProvider live at the `@qalam/ui/motion` subpath.
 * No data fetching, no router, no app state (docs/08 §1).
 */

// ── Theme ──────────────────────────────────────────────────────────────────
export { getAntdTheme } from './theme/antd-theme.js';
export type { ThemeMode } from './types.js';

// ── Utilities ──────────────────────────────────────────────────────────────
export { cn } from './lib/cn.js';
export type { LinkComponent } from './lib/link.js';

// ── Primitives (Q-prefixed) ──────────────────────────────────────────────────
export { QButton } from './components/q-button.js';
export type { QButtonProps, QButtonVariant, QButtonSize } from './components/q-button.js';
export { QInput } from './components/q-input.js';
export type { QInputProps } from './components/q-input.js';
export { QTextArea } from './components/q-textarea.js';
export type { QTextAreaProps } from './components/q-textarea.js';
export { QSelect } from './components/q-select.js';
export type { QSelectProps } from './components/q-select.js';
export { QSearch } from './components/q-search.js';
export type { QSearchProps } from './components/q-search.js';
export { QCard } from './components/q-card.js';
export type { QCardProps } from './components/q-card.js';
export { QTag } from './components/q-tag.js';
export type { QTagProps, QTagColor } from './components/q-tag.js';
export { QBadge } from './components/q-badge.js';
export type { QBadgeProps } from './components/q-badge.js';
export { QAvatar } from './components/q-avatar.js';
export type { QAvatarProps } from './components/q-avatar.js';
export { QSpinner } from './components/q-spinner.js';
export type { QSpinnerProps } from './components/q-spinner.js';
export { QSkeleton } from './components/q-skeleton.js';
export type { QSkeletonProps } from './components/q-skeleton.js';
export { QEmptyState } from './components/q-empty-state.js';
export type { QEmptyStateProps } from './components/q-empty-state.js';
export { QErrorState } from './components/q-error-state.js';
export type { QErrorStateProps } from './components/q-error-state.js';
export { QPagination } from './components/q-pagination.js';
export type { QPaginationProps } from './components/q-pagination.js';
export { QDialog } from './components/q-dialog.js';
export type { QDialogProps } from './components/q-dialog.js';
export { QDrawer } from './components/q-drawer.js';
export type { QDrawerProps } from './components/q-drawer.js';
export { QPageContainer } from './components/q-page-container.js';
export type { QPageContainerProps } from './components/q-page-container.js';
export { QSectionHeader } from './components/q-section-header.js';
export type { QSectionHeaderProps } from './components/q-section-header.js';
export { QPageLoader, QSectionLoader, QLoadingOverlay } from './components/loaders.js';
export type { QLoaderProps, QLoadingOverlayProps } from './components/loaders.js';

// ── Hooks (require an AntD `<App>` provider) ─────────────────────────────────
export { useToast } from './hooks/use-toast.js';
export type { ToastApi, ToastOptions } from './hooks/use-toast.js';
export { useConfirm } from './hooks/use-confirm.js';
export type { ConfirmOptions } from './hooks/use-confirm.js';
