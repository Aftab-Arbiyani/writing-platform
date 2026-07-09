import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ThemeToggle } from './theme-toggle';

describe('ThemeToggle', () => {
  it('renders a labelled toggle button', () => {
    render(<ThemeToggle />);
    expect(
      screen.getByRole('button', { name: /switch to (light|dark) theme/i }),
    ).toBeInTheDocument();
  });
});
