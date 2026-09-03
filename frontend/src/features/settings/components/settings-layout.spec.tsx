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
  /**
   * D5 removed the "AI" section. Its three cases here asserted that it was present, that `end: false`
   * kept it marked current across its four sub-pages, and that it was unconditional where Safety and
   * Billing are flag-gated — all true, and all about a section that no longer exists.
   *
   * What replaces them is the absence, asserted directly. A nav entry pointing at a deleted route is
   * the failure this guards: it renders normally, looks correct in review, and only fails when a
   * reader clicks it.
   */
  it('offers no AI section — the tools live in the editor now', () => {
    renderWithProviders(<SettingsLayout />, { route: '/settings/profile' });
    expect(screen.queryByRole('link', { name: 'AI' })).not.toBeInTheDocument();
  });

  it('links nowhere under /settings/ai, which no longer resolves', () => {
    renderWithProviders(<SettingsLayout />, { route: '/settings/profile' });
    const hrefs = screen
      .getAllByRole('link')
      .map((link) => link.getAttribute('href') ?? '')
      .filter((href) => href.startsWith('/settings/ai'));
    expect(hrefs).toEqual([]);
  });

  it('still renders the sections that remain', () => {
    renderWithProviders(<SettingsLayout />, { route: '/settings/profile' });
    expect(screen.getByRole('link', { name: 'Profile' })).toBeInTheDocument();
  });
});
