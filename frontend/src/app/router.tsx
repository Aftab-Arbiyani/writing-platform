import type { ReactElement } from 'react';
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router';

import { RequireAuth } from '@/app/guards/require-auth';
import { RequireGuest } from '@/app/guards/require-guest';
import { AuthLayout } from '@/app/layouts/auth-layout';
import { RootLayout } from '@/app/layouts/root-layout';
import { Forbidden } from '@/app/pages/forbidden';
import { HomeRoute } from '@/app/pages/home-route';
import { NotFound } from '@/app/pages/not-found';
import { Offline } from '@/app/pages/offline';
import { RouteErrorBoundary } from '@/app/pages/route-error';
import { Unauthorized } from '@/app/pages/unauthorized';

/**
 * Route tree (docs/11). Public + authenticated surfaces share RootLayout (chrome); the
 * auth corridor is a SIBLING tree under AuthLayout (no chrome). Feature route groups are
 * lazy() for per-route code-splitting; F1 ships placeholders only. Full map: docs/11 §10.
 */
const router = createBrowserRouter([
  {
    element: <RootLayout />,
    errorElement: <RouteErrorBoundary />,
    children: [
      { index: true, element: <HomeRoute /> },
      { path: 'feed', lazy: () => import('@/app/routes/feed') },
      { path: 'search', lazy: () => import('@/app/routes/search') },
      { path: 'discover', lazy: () => import('@/app/routes/discover') },
      // The reading view (W1, docs/45 §4.1). Public with optional auth — the server decides what
      // this viewer may see. Static, so it out-ranks the bare `:handle` route registered last.
      { path: 'p/:slug', lazy: () => import('@/app/routes/piece') },
      // Error surfaces (also reachable directly / via deep links):
      { path: '401', element: <Unauthorized /> },
      { path: '403', element: <Forbidden /> },
      { path: '404', element: <NotFound /> },
      { path: 'offline', element: <Offline /> },
      // Authenticated surfaces (with app chrome) — gated by RequireAuth (a pathless route).
      {
        element: <RequireAuth />,
        children: [
          { path: 'me', lazy: () => import('@/app/routes/me') },
          { path: 'me/drafts', lazy: () => import('@/app/routes/drafts') },
          { path: 'me/follow-requests', lazy: () => import('@/app/routes/follow-requests') },
          // Collaboration inbox (AF6 W3a, docs/49) — story invitations addressed to the viewer.
          { path: 'me/invitations', lazy: () => import('@/app/routes/invitations') },
          // A story's collaborator roster. Its PATH sits under /write (it is a writing-side
          // surface), but it is declared here, inside the chrome'd tree, on purpose: it is a
          // management page that needs the top bar and navigation, not the distraction-free
          // editor shell below.
          {
            path: 'write/:storyId/collaborators',
            lazy: () => import('@/app/routes/collaborators'),
          },
          // W3b — the inline-review surfaces, chrome'd for the same reason as the roster above.
          {
            path: 'write/:storyId/comments',
            lazy: () => import('@/app/routes/story-comments'),
          },
          {
            path: 'write/:storyId/suggestions',
            lazy: () => import('@/app/routes/story-suggestions'),
          },
          // W3c — review → approve → publish, versions and publication history. Chrome'd like the
          // other three story-management surfaces above.
          {
            path: 'write/:storyId/publishing',
            lazy: () => import('@/app/routes/story-publishing'),
          },
          { path: 'me/stats', lazy: () => import('@/app/routes/stats') },
          { path: 'me/stats/pieces/:id', lazy: () => import('@/app/routes/piece-stats') },
          { path: 'notifications', lazy: () => import('@/app/routes/notifications') },
          // Settings is a nested layout surface (docs/11 §1); index → /settings/profile.
          {
            path: 'settings',
            lazy: () => import('@/app/routes/settings/layout'),
            children: [
              { index: true, element: <Navigate to="/settings/profile" replace /> },
              { path: 'profile', lazy: () => import('@/app/routes/settings/profile') },
              { path: 'account', lazy: () => import('@/app/routes/settings/account') },
              { path: 'appearance', lazy: () => import('@/app/routes/settings/appearance') },
              { path: 'notifications', lazy: () => import('@/app/routes/settings/notifications') },
              // W3c — blocks/mutes + account standing. A settings section rather than its own
              // top-level route: it is account-scoped, like every other tab here.
              { path: 'blocks', lazy: () => import('@/app/routes/settings/blocks') },
              // W4 — monetization. `billing` is the hub and the only one in the section nav; the
              // other four are reached from it (docs/45 §4). Registered unconditionally: the
              // `VITE_ENABLE_MONETIZATION` kill switch decides whether the nav OFFERS them, and each
              // page renders its own "not available yet" state when the flag is down — so a
              // bookmarked URL explains itself instead of 404ing, which is how `blocks` behaves too.
              { path: 'billing', lazy: () => import('@/app/routes/settings/billing') },
              { path: 'billing/plans', lazy: () => import('@/app/routes/settings/billing-plans') },
              { path: 'billing/usage', lazy: () => import('@/app/routes/settings/billing-usage') },
              {
                path: 'billing/credits',
                lazy: () => import('@/app/routes/settings/billing-credits'),
              },
              {
                path: 'billing/history',
                lazy: () => import('@/app/routes/settings/billing-history'),
              },
            ],
          },
        ],
      },
      // Writer profile — public/optional-auth. Registered LAST as a bare `:handle` (docs/11 §1.1):
      // the module validates the `@` prefix + reserved words. Static routes above out-rank it.
      { path: ':handle', lazy: () => import('@/app/routes/profile') },
      { path: '*', element: <NotFound /> },
    ],
  },
  {
    // The editor is a distraction-free surface (docs/06 §3.3) — NO app chrome, its own header.
    // Authenticated; its own sibling tree so RootLayout's top/tab bars don't intrude. TipTap is
    // lazy so it (and its extensions) stay out of every other chunk.
    element: <RequireAuth />,
    errorElement: <RouteErrorBoundary />,
    children: [
      { path: 'write', lazy: () => import('@/app/routes/write') },
      { path: 'write/:draftId', lazy: () => import('@/app/routes/write') },
    ],
  },
  {
    // Guest-only auth corridor — no app chrome (docs/11 §3). Logged-in users are bounced
    // to their returnTo/feed by RequireGuest.
    element: <RequireGuest />,
    errorElement: <RouteErrorBoundary />,
    children: [
      {
        element: <AuthLayout />,
        children: [
          { path: 'auth/login', lazy: () => import('@/app/routes/auth-login') },
          { path: 'auth/register', lazy: () => import('@/app/routes/auth-register') },
          {
            path: 'auth/forgot-password',
            lazy: () => import('@/app/routes/auth-forgot-password'),
          },
          { path: 'auth/reset-password', lazy: () => import('@/app/routes/auth-reset-password') },
          { path: 'auth/callback', lazy: () => import('@/app/routes/auth-callback') },
        ],
      },
    ],
  },
  {
    // Neutral auth corridor (NO guard): email verification must be reachable both by a
    // signed-out visitor clicking the emailed link AND by a freshly-registered
    // (authenticated-but-unverified) user (docs/11 §10). RequireGuest would bounce the latter.
    element: <AuthLayout />,
    errorElement: <RouteErrorBoundary />,
    children: [{ path: 'auth/verify-email', lazy: () => import('@/app/routes/auth-verify-email') }],
  },
]);

export function AppRouter(): ReactElement {
  return <RouterProvider router={router} />;
}
