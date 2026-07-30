import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AppProviders } from './providers';

describe('AppProviders', () => {
  it('mounts the full provider stack and renders children', () => {
    // Exercises ErrorBoundary → Helmet → QueryClient → AntD ConfigProvider + App → Motion.
    // Doubles as the react-helmet-async × React 19 compatibility guard.
    render(
      <AppProviders>
        <span>hello sanctuary</span>
      </AppProviders>,
    );
    expect(screen.getByText('hello sanctuary')).toBeInTheDocument();
  });
});
