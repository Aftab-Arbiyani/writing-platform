import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Notification CLIENT/UI state (docs/12 §3) — the ONLY notification state in Zustand. The unread
 * COUNT and the inbox itself are SERVER state and live in TanStack Query (hard-rule #4 — server
 * state is never mirrored into Zustand); the badge renders from that query. What belongs here is
 * purely local chrome:
 *
 *  1. **Popover open state** — the desktop bell's dropdown (not URL-worthy, not server-owned).
 *  2. **Toast preference** — whether an unobtrusive toast announces newly-arrived notifications
 *     (polling-driven, since there is no WebSocket). A genuine device preference → persisted.
 *
 * Subscribe with narrow selectors. Only `toastsEnabled` is persisted.
 */
interface NotificationsState {
  popoverOpen: boolean;
  /** Announce new notifications with a toast when the polled unread count rises. */
  toastsEnabled: boolean;

  openPopover: () => void;
  closePopover: () => void;
  togglePopover: () => void;
  setPopoverOpen: (open: boolean) => void;
  setToastsEnabled: (enabled: boolean) => void;
}

export const useNotificationsStore = create<NotificationsState>()(
  persist(
    (set) => ({
      popoverOpen: false,
      toastsEnabled: true,

      openPopover: () => {
        set({ popoverOpen: true });
      },
      closePopover: () => {
        set({ popoverOpen: false });
      },
      togglePopover: () => {
        set((state) => ({ popoverOpen: !state.popoverOpen }));
      },
      setPopoverOpen: (open) => {
        set({ popoverOpen: open });
      },
      setToastsEnabled: (enabled) => {
        set({ toastsEnabled: enabled });
      },
    }),
    {
      name: 'qalam-notifications',
      // Persist the preference only; popover open-state is session chrome.
      partialize: (state) => ({ toastsEnabled: state.toastsEnabled }),
    },
  ),
);
