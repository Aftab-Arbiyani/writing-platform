import { Role } from '@umberleaf/shared';
import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { AppSidebar } from '@/components/app-sidebar';
import { useAuthStore } from '@/stores/auth.store';
import { renderWithProviders } from '@/test/render';

afterEach(() => useAuthStore.getState().clear());

/**
 * Collapsed-rail layout (docs/48). AntD keeps rendering a menu group's title when the menu is
 * `inlineCollapsed` — it does not hide it — so at the 64px rail width "Moderation" and
 * "Platform" were drawn full-length and clipped mid-word. Collapsed, the groups therefore
 * flatten to their items with a divider between them.
 *
 * The other half of that defect was width — AntD derives a collapsed menu from
 * `controlHeightLG * 2`, which the shared theme's `controlHeight: 40` makes 100px inside a 64px
 * rail — and is fixed with a `collapsedWidth` token. jsdom computes no layout, so only the
 * group titles are assertable here; the width was verified in a browser.
 */
describe('AppSidebar', () => {
  it('shows group titles when expanded', async () => {
    useAuthStore.setState({ status: 'authenticated', role: Role.SuperAdmin });
    renderWithProviders(<AppSidebar />);

    // `find*`, not `get*`: AntD's Menu settles its own state after mount, and awaiting the
    // query flushes that update instead of leaving an act() warning behind.
    expect(await screen.findByRole('menuitem', { name: 'Reports' })).toBeInTheDocument();
    expect(screen.getByText('Moderation')).toBeInTheDocument();
  });

  it('drops the group titles when collapsed, keeping the items', async () => {
    useAuthStore.setState({ status: 'authenticated', role: Role.SuperAdmin });
    const { container } = renderWithProviders(<AppSidebar collapsed />);

    // The destinations themselves survive the flattening.
    expect(await screen.findByRole('menuitem', { name: 'Reports' })).toBeInTheDocument();
    expect(screen.queryByText('Moderation')).not.toBeInTheDocument();
    expect(screen.queryByText('Platform')).not.toBeInTheDocument();
    expect(container.querySelectorAll('.ant-menu-item-group-title')).toHaveLength(0);
    expect(container.querySelectorAll('.ant-menu-item-divider').length).toBeGreaterThan(0);
  });
});
