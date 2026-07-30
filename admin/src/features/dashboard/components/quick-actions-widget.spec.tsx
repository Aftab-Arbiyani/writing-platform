import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '@/test/render';

import { QuickActionsWidget } from './quick-actions-widget';

describe('QuickActionsWidget', () => {
  it('renders navigational quick actions pointing at real routes', () => {
    renderWithProviders(<QuickActionsWidget />);
    expect(screen.getByRole('link', { name: /View users/i })).toHaveAttribute('href', '/users');
    expect(screen.getByRole('link', { name: /Review reports/i })).toHaveAttribute(
      'href',
      '/reports',
    );
    expect(screen.getByRole('link', { name: /Audit logs/i })).toHaveAttribute(
      'href',
      '/audit-logs',
    );
  });
});
