import type { ReactElement } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router';

import { RequireAuth } from '@/app/guards/require-auth';
import { RequireGuest } from '@/app/guards/require-guest';
import { AuthLayout } from '@/app/layouts/auth-layout';
import { RootLayout } from '@/app/layouts/root-layout';
import { Forbidden } from '@/app/pages/forbidden';
import { NotFound } from '@/app/pages/not-found';
import { Offline } from '@/app/pages/offline';
import { Landing } from '@/app/pages/placeholder-home';
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
      { index: true, element: <Landing /> },
      { path: 'feed', lazy: () => import('@/app/routes/feed') },
      { path: 'search', lazy: () => import('@/app/routes/search') },
      // Error surfaces (also reachable directly / via deep links):
      { path: '401', element: <Unauthorized /> },
      { path: '403', element: <Forbidden /> },
      { path: '404', element: <NotFound /> },
      { path: 'offline', element: <Offline /> },
      // Authenticated surfaces — gated by RequireAuth (a pathless layout route):
      {
        element: <RequireAuth />,
        children: [
          { path: 'write', lazy: () => import('@/app/routes/write') },
          { path: 'notifications', lazy: () => import('@/app/routes/notifications') },
          { path: 'settings', lazy: () => import('@/app/routes/settings') },
        ],
      },
      { path: '*', element: <NotFound /> },
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
