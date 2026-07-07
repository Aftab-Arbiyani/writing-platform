import type { ReactElement } from 'react';

import { createBrowserRouter, RouterProvider } from 'react-router';

import NotFound from '@/app/pages/not-found';
import PlaceholderHome from '@/app/pages/placeholder-home';

/**
 * Routing shell only. The full route map lives in docs/11_RoutingArchitecture.md
 * (`/feed`, `/p/:slug`, `/@:username`, `/write`, `/search`, `/me/*`, `/settings/*`,
 * `/auth/*`). Feature routes register here in Phase 1 as lazy() route groups so
 * each feature ships as its own chunk.
 */
const router = createBrowserRouter([
  { path: '/', element: <PlaceholderHome /> },
  { path: '*', element: <NotFound /> },
]);

export function AppRouter(): ReactElement {
  return <RouterProvider router={router} />;
}
