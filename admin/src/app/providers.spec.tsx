import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AppProviders } from '@/app/providers';

describe('AppProviders', () => {
  it('renders children within the full provider stack', () => {
    // Exercises ErrorBoundary → Helmet → QueryClient → AntD ConfigProvider + App → Motion.
    render(
      <AppProviders>
        <div>admin-ready</div>
      </AppProviders>,
    );
    expect(screen.getByText('admin-ready')).toBeInTheDocument();
  });
});
