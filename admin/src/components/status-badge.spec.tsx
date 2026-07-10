import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { StatusBadge } from '@/components/status-badge';

describe('StatusBadge', () => {
  it('renders the raw status when no label is given', () => {
    render(<StatusBadge status="active" />);
    expect(screen.getByText('active')).toBeInTheDocument();
  });

  it('renders a custom label', () => {
    render(<StatusBadge status="suspended" label="Suspended" />);
    expect(screen.getByText('Suspended')).toBeInTheDocument();
  });
});
