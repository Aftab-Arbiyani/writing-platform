import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '@/test/render';

import { ActivityWidget } from './activity-widget';

describe('ActivityWidget', () => {
  it('renders an honest unavailable state (no backend activity endpoint yet)', () => {
    renderWithProviders(<ActivityWidget />);
    expect(screen.getByText('Activity feed unavailable')).toBeInTheDocument();
  });
});
