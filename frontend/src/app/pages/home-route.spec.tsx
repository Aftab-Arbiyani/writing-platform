import { screen } from '@testing-library/react';
import { Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { useAuthStore } from '@/stores/auth.store';
import { useOnboardingStore } from '@/stores/onboarding.store';
import { renderWithProviders } from '@/test/render';

import { HomeRoute } from './home-route';

beforeEach(() => {
  useOnboardingStore.setState({ complete: false });
  useAuthStore.setState({ status: 'anonymous' } as never);
});

afterEach(() => {
  useAuthStore.getState().clear();
  useOnboardingStore.setState({ complete: false });
});

// `renderWithProviders` supplies the router (and HelmetProvider, which `Landing` needs through
// `<Seo>`), so the entry URL comes from its `route` option rather than a nested MemoryRouter.
function renderAt(route: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/" element={<HomeRoute />} />
      <Route path="/onboarding" element={<div>intro screen</div>} />
      <Route path="/feed" element={<div>feed content</div>} />
      <Route path="/p/:slug" element={<div>the story</div>} />
    </Routes>,
    { route },
  );
}

const renderRoot = () => renderAt('/');

describe('HomeRoute', () => {
  it('sends a first-time anonymous visitor to the intro', () => {
    renderRoot();
    expect(screen.getByText('intro screen')).toBeInTheDocument();
  });

  it('shows the landing page once the intro is done', () => {
    useOnboardingStore.setState({ complete: true });
    renderRoot();
    expect(screen.queryByText('intro screen')).not.toBeInTheDocument();
  });

  it('never intercepts an authenticated reader, flag or no flag', () => {
    // The flag is per-browser, so a signed-in writer on a fresh browser must not be greeted with
    // "A place for your words". Their session is the proof they have been here.
    useAuthStore.setState({ status: 'authenticated' } as never);
    renderRoot();
    expect(screen.getByText('feed content')).toBeInTheDocument();
  });

  it('holds the loader while the session is unresolved, rather than guessing', () => {
    // Redirecting here would flash the intro at a returning user mid-boot-refresh.
    useAuthStore.setState({ status: 'unknown' } as never);
    renderRoot();
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByText('intro screen')).not.toBeInTheDocument();
  });

  it('leaves every OTHER url alone — the shared-link case', () => {
    // The regression this design exists to prevent: an earlier draft gated the whole chrome tree, so
    // opening a shared story link as a first-time visitor showed the intro instead of the story.
    renderAt('/p/a-shared-story');
    expect(screen.getByText('the story')).toBeInTheDocument();
    expect(screen.queryByText('intro screen')).not.toBeInTheDocument();
  });
});
