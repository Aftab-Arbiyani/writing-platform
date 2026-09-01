import { fireEvent, screen } from '@testing-library/react';
import type * as ReactRouter from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useOnboardingStore } from '@/stores/onboarding.store';
import { renderWithProviders } from '@/test/render';

import { OnboardingPage } from './onboarding-page';

const navigate = vi.fn();
vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof ReactRouter>('react-router');
  return { ...actual, useNavigate: () => navigate };
});

beforeEach(() => {
  navigate.mockClear();
  useOnboardingStore.setState({ complete: false });
});

afterEach(() => {
  useOnboardingStore.setState({ complete: false });
});

describe('OnboardingPage', () => {
  it('opens on the first slide, with mobile’s copy verbatim', () => {
    renderWithProviders(<OnboardingPage />);
    expect(screen.getByRole('heading', { name: 'A place for your words' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next' })).toBeInTheDocument();
  });

  it('advances through all three slides and only then offers Get started', () => {
    renderWithProviders(<OnboardingPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(
      screen.getByRole('heading', { name: 'Read and write, beautifully' }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('heading', { name: 'Your words, your control' })).toBeInTheDocument();

    // The label change is what tells a screen-reader user they are at the end — the dots are
    // aria-hidden precisely so the position is announced once, not twice.
    expect(screen.getByRole('button', { name: 'Get started' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument();
  });

  it('persists completion and hands off to sign-in from the LAST slide', () => {
    renderWithProviders(<OnboardingPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Get started' }));

    expect(useOnboardingStore.getState().complete).toBe(true);
    expect(navigate).toHaveBeenCalledWith('/auth/login', { replace: true });
  });

  it('Skip is the SAME commitment as finishing — it persists too', () => {
    // If Skip navigated without persisting, the intro would reappear on every visit, which is the
    // one behaviour that would make it feel broken. Mobile treats the two identically.
    renderWithProviders(<OnboardingPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));

    expect(useOnboardingStore.getState().complete).toBe(true);
    expect(navigate).toHaveBeenCalledWith('/auth/login', { replace: true });
  });

  it('replaces rather than pushes, so Back cannot land on the intro again', () => {
    renderWithProviders(<OnboardingPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    expect(navigate).toHaveBeenCalledWith(
      '/auth/login',
      expect.objectContaining({ replace: true }),
    );
  });

  it('renders one slide at a time', () => {
    // Web advances by button with no swipeable carousel, so mounting the other slides would add
    // nothing but an a11y tree to hide.
    renderWithProviders(<OnboardingPage />);
    expect(screen.getAllByRole('heading')).toHaveLength(1);
  });
});
