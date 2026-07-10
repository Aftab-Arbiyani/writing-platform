import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Side-nav UI state (client state → Zustand). `collapsed` (desktop rail vs full) persists so an
 * operator's preference survives reloads; `mobileOpen` is the transient drawer state on narrow
 * viewports (never persisted). Server state never lives here.
 */
interface SidebarState {
  collapsed: boolean;
  mobileOpen: boolean;
  toggleCollapsed: () => void;
  setCollapsed: (value: boolean) => void;
  setMobileOpen: (value: boolean) => void;
}

export const useSidebarStore = create<SidebarState>()(
  persist(
    (set) => ({
      collapsed: false,
      mobileOpen: false,
      toggleCollapsed: () => set((state) => ({ collapsed: !state.collapsed })),
      setCollapsed: (value) => set({ collapsed: value }),
      setMobileOpen: (value) => set({ mobileOpen: value }),
    }),
    {
      name: 'qalam-admin-sidebar',
      // Only the desktop preference persists; the mobile drawer must always start closed.
      partialize: (state) => ({ collapsed: state.collapsed }),
    },
  ),
);
