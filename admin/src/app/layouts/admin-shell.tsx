import { cn } from '@qalam/ui';
import { pageTransition } from '@qalam/ui/motion';
import { motion } from 'framer-motion';
import type { ReactElement } from 'react';
import { Outlet, useLocation } from 'react-router';

import { AppFooter } from '@/components/app-footer';
import { AppHeader } from '@/components/app-header';
import { AppSidebar } from '@/components/app-sidebar';
import { Drawer } from '@/components/drawer';
import { useSidebarStore } from '@/stores/sidebar.store';

/**
 * The admin console shell (docs/10 §3.4, docs/11 §3): a persistent side-nav + top header + content
 * area + footer. A custom flex layout (not AntD `Layout`) so every surface resolves `--q-*` tokens
 * directly — guaranteed dark-mode + RTL (logical `border-e`) correctness, the same approach the
 * reader app's shell uses. AntD supplies the Menu/Drawer/Dropdown inside. Desktop shows a
 * collapsible rail; below `lg` the nav moves into a drawer. Enter-only page fade (reduced-motion
 * aware via MotionProvider).
 */
export function AdminShell(): ReactElement {
  const location = useLocation();
  const collapsed = useSidebarStore((state) => state.collapsed);
  const mobileOpen = useSidebarStore((state) => state.mobileOpen);
  const setMobileOpen = useSidebarStore((state) => state.setMobileOpen);

  return (
    <div className="flex min-h-dvh bg-canvas">
      {/* Desktop persistent rail */}
      <aside
        className={cn(
          'hidden flex-shrink-0 flex-col border-e border-line bg-surface transition-[width] duration-200 lg:flex',
          collapsed ? 'w-16' : 'w-60',
        )}
      >
        <div className="flex h-14 items-center gap-2 border-b border-line px-4">
          <span className="flex size-7 items-center justify-center rounded-md bg-accent text-sm font-semibold text-[var(--q-accent-contrast,#fff)]">
            Q
          </span>
          {!collapsed ? <span className="text-sm font-semibold text-ink">Qalam Admin</span> : null}
        </div>
        <AppSidebar collapsed={collapsed} />
      </aside>

      {/* Mobile drawer nav */}
      <Drawer
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        title="Qalam Admin"
        placement="left"
        width={260}
      >
        <AppSidebar onNavigate={() => setMobileOpen(false)} />
      </Drawer>

      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader />
        <main id="main" tabIndex={-1} className="flex-1 overflow-x-hidden p-4 outline-none sm:p-6">
          <motion.div
            key={location.pathname}
            variants={pageTransition}
            initial="initial"
            animate="animate"
          >
            <Outlet />
          </motion.div>
        </main>
        <AppFooter />
      </div>
    </div>
  );
}
