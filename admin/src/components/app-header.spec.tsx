import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AppHeader } from '@/components/app-header';
import { renderWithProviders } from '@/test/render';

/**
 * Regression pin for the duplicated navigation (docs/48): both sidebar toggles carried their
 * breakpoint as `className` on a `QButton`, which is an AntD `Button`. AntD's cssinjs is
 * unlayered and therefore beats Tailwind's `@layer utilities`, so `lg:hidden` — measured in a
 * real browser — left the button at `display: inline-flex` at every width. The hamburger stayed
 * on screen next to the persistent desktop rail and opened a drawer containing the very nav
 * already visible beside it.
 *
 * jsdom applies no cascade and no media queries, so a rendering test CANNOT catch that; it can
 * only hold the structural fix in place. Hence the assertion is about WHERE the class lives: on
 * a plain wrapper the utility reaches, never back on the AntD button where it is inert.
 */
describe('AppHeader sidebar toggles', () => {
  it.each([
    ['Open navigation', 'lg:hidden'],
    ['Collapse sidebar', 'hidden'],
  ])('keeps the %s breakpoint off the AntD button', (label, cls) => {
    renderWithProviders(<AppHeader />);
    const button = screen.getByRole('button', { name: label });

    expect(button.className).not.toContain(cls);
    expect(button.parentElement?.className).toContain(cls);
  });
});
