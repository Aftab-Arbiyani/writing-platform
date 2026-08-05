import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '@/test/render';

import { SettingsLayout } from './settings-layout';

/**
 * The settings section nav is the **entry point** for W8's three AI surfaces, and this file exists
 * because "built but unreachable" has shipped three times on this platform (R-1, M5-1, W5-3 — docs/48).
 * A page with no link to it is not done, so the link is asserted, not assumed.
 */
describe('SettingsLayout', () => {
  it('offers the AI section', () => {
    renderWithProviders(<SettingsLayout />, { route: '/settings/profile' });
    const nav = screen.getByRole('navigation', { name: 'Settings sections' });
    const link = screen.getByRole('link', { name: 'AI' });
    expect(nav).toContainElement(link);
    expect(link).toHaveAttribute('href', '/settings/ai');
  });

  it('keeps the AI entry marked current on a sub-page', () => {
    // The hub has four children. With `end: true` the nav would mark nothing current while a reader
    // is on one of them, losing the `aria-current="page"` it relies on to say where they are — the
    // same reason Billing sets `end: false`.
    renderWithProviders(<SettingsLayout />, { route: '/settings/ai/conversations' });
    expect(screen.getByRole('link', { name: 'AI' })).toHaveAttribute('aria-current', 'page');
  });

  it('shows AI regardless of the collaboration and monetization flags', () => {
    // Safety and Billing are flag-gated because their pages render "not available yet" behind a dark
    // launch. AI has no such kill switch — the master flag is the server's, behind GET /ai/features —
    // so the section is unconditional and the hub reports what the server says.
    renderWithProviders(<SettingsLayout />, { route: '/settings/profile' });
    expect(screen.getByRole('link', { name: 'AI' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Profile' })).toBeInTheDocument();
  });
});
