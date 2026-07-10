import { QButton } from '@qalam/ui';
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
      <QButton
        variant="ghost"
        size="sm"
        icon={MenuIcon}
        aria-label="Open navigation"
        className="lg:hidden"
        onClick={() => setMobileOpen(true)}
      />
      <QButton
        variant="ghost"
        size="sm"
        icon={collapsed ? PanelLeftOpen : PanelLeftClose}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        className="hidden lg:inline-flex"
        onClick={toggleCollapsed}
      />

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
