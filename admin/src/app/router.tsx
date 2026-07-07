import { createBrowserRouter } from 'react-router';

import NotFound from '@/app/pages/not-found';
import PlaceholderDashboard from '@/app/pages/placeholder-dashboard';

/**
 * Foundation router — one placeholder route plus a catch-all. No features yet.
 *
 * Phase 1 registers the full admin route map here (docs/00 §10), each section
 * behind RequireRole guards per docs/11:
 *
 *   /login · /dashboard · /users · /pieces · /reports · /card-templates
 *   /prompts · /languages · /featured · /analytics · /moderators · /roles
 *   /audit-logs
 *
 * Sections land as lazy feature routes (features/<section>/) so each admin
 * area stays independently deletable and code-split.
 */
export const router = createBrowserRouter([
  {
    path: '/',
    element: <PlaceholderDashboard />,
  },
  {
    path: '*',
    element: <NotFound />,
  },
]);
