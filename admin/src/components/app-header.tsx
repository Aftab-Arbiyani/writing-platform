import { QButton } from '@umberleaf/ui';
import { Menu as MenuIcon, PanelLeftClose, PanelLeftOpen, Plus, Search } from 'lucide-react';
import type { ReactElement } from 'react';

import { AppBreadcrumbs } from '@/components/app-breadcrumbs';
import { EnvBadge } from '@/components/env-badge';
import { Modal } from '@/components/modal';
import { ThemeToggle } from '@/components/theme-toggle';
import { UserMenu } from '@/components/user-menu';
import { useAdminUiStore } from '@/stores/admin-ui.store';
import { useSidebarStore } from '@/stores/sidebar.store';

/**
 * Top header (docs/10 §3.4): sidebar toggles + breadcrumbs on the start side; env badge, global
 * search + quick-action affordances, theme switch, and account menu on the end side. Global search
 * and quick actions are PLACEHOLDER surfaces in A1 (they open a "coming soon" dialog via the
 * admin-ui store) — feature epics wire them to a command palette / create flows.
 */
export function AppHeader(): ReactElement {
  const collapsed = useSidebarStore((state) => state.collapsed);
  const toggleCollapsed = useSidebarStore((state) => state.toggleCollapsed);
  const setMobileOpen = useSidebarStore((state) => state.setMobileOpen);
  const searchOpen = useAdminUiStore((state) => state.searchOpen);
  const setSearchOpen = useAdminUiStore((state) => state.setSearchOpen);
  const quickActionOpen = useAdminUiStore((state) => state.quickActionOpen);
  const setQuickActionOpen = useAdminUiStore((state) => state.setQuickActionOpen);

  return (
    <header
      data-testid="admin-header"
      className="sticky top-0 z-20 flex h-14 flex-shrink-0 items-center gap-2 border-b border-line bg-surface px-3 sm:px-4"
    >
      {/*
        The breakpoint lives on a plain <span>, NOT as `className` on the QButton. AntD's
        cssinjs injects into an unlayered <style>, and unlayered declarations beat layered ones
        regardless of specificity, so `.ant-btn{display:inline-flex}` wins over Tailwind's
        `.lg\:hidden` in `@layer utilities` — the same cascade trap global.css records for
        `underline` on links. Measured in the running app: adding `lg:hidden`, or even plain
        `hidden`, to a rendered AntD button leaves `display: inline-flex`.

        So both toggles were always on screen. On desktop the hamburger opened a drawer holding
        the nav the persistent rail was already showing; below `lg` the collapse button toggled
        a rail that is not rendered there at all. A <span> carries no AntD styles, so the
        utility applies to it.
      */}
      <span className="inline-flex lg:hidden">
        <QButton
          variant="ghost"
          size="sm"
          icon={MenuIcon}
          aria-label="Open navigation"
          onClick={() => setMobileOpen(true)}
        />
      </span>
      <span className="hidden lg:inline-flex">
        <QButton
          variant="ghost"
          size="sm"
          icon={collapsed ? PanelLeftOpen : PanelLeftClose}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          onClick={toggleCollapsed}
        />
      </span>

      <div className="hidden md:block">
        <AppBreadcrumbs />
      </div>

      <div className="ms-auto flex items-center gap-2">
        <button
          type="button"
          aria-label="Global search"
          onClick={() => setSearchOpen(true)}
          className="hidden items-center gap-2 rounded-md border border-line px-3 py-1.5 text-sm text-ink-muted hover:bg-raised sm:flex"
        >
          <Search size={15} aria-hidden />
          <span>Search…</span>
        </button>

        <QButton
          variant="secondary"
          size="sm"
          icon={Plus}
          onClick={() => setQuickActionOpen(true)}
          aria-label="Quick actions"
        >
          <span className="hidden md:inline">New</span>
        </QButton>

        <EnvBadge />
        <ThemeToggle />
        <UserMenu />
      </div>

      {/* Placeholder surfaces — wired to the admin-ui store; feature epics replace the bodies. */}
      <Modal open={searchOpen} onClose={() => setSearchOpen(false)} title="Global search" size="md">
        <p className="text-sm text-ink-secondary">
          Global search across users, pieces, and reports arrives in a later admin epic.
        </p>
      </Modal>
      <Modal
        open={quickActionOpen}
        onClose={() => setQuickActionOpen(false)}
        title="Quick actions"
        size="sm"
      >
        <p className="text-sm text-ink-secondary">
          Quick create actions arrive with their sections in a later admin epic.
        </p>
      </Modal>
    </header>
  );
}
