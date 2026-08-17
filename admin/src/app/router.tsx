import { PERMISSIONS, Role } from '@qalam/shared';
import { createBrowserRouter, Navigate } from 'react-router';

import { AdminErrorBoundary } from '@/app/error-boundary';
import { RequireAuth } from '@/app/guards/require-auth';
import { RequireGuest } from '@/app/guards/require-guest';
import { RequirePermission } from '@/app/guards/require-permission';
import { RequireRole } from '@/app/guards/require-role';
import { AdminShell } from '@/app/layouts/admin-shell';
import { AppRoot } from '@/app/layouts/app-root';
import { AuthLayout } from '@/app/layouts/auth-layout';
import { Forbidden } from '@/app/pages/forbidden';
import { NotFound } from '@/app/pages/not-found';
import { Offline } from '@/app/pages/offline';
import { Unauthorized } from '@/app/pages/unauthorized';
import { ROUTES } from '@/lib/routes';

/**
 * Admin router (docs/11 §2–§9). `AppRoot` wraps everything to mount the global SessionExpiredDialog.
 * Guards are pathless layout routes composed with visual layouts, so redirect logic is never
 * duplicated per page. Every section is a `lazy()` route module → one JS chunk per admin area. Role
 * floors: guest → /login · moderator → console + pieces/prompts/reports · admin → users/analytics/…
 * · super_admin → /roles. A below-floor role gets an honest 403, not a redirect. Sections render
 * placeholder pages (A2 ships auth only; feature epics fill them in).
 */
export const router = createBrowserRouter([
  {
    element: <AppRoot />,
    children: [
      // Always-reachable 401 (deep links / direct nav).
      { path: ROUTES.unauthorized, element: <Unauthorized /> },

      // Guest corridor — sign-in.
      {
        element: <RequireGuest />,
        children: [
          {
            element: <AuthLayout />,
            children: [{ path: ROUTES.login, lazy: () => import('@/app/routes/login') }],
          },
        ],
      },

      // Authenticated console — moderator floor for the whole shell.
      {
        element: <RequireAuth />,
        children: [
          {
            element: <RequireRole min={Role.Moderator} />,
            children: [
              {
                element: <AdminShell />,
                errorElement: <AdminErrorBoundary />,
                children: [
                  { index: true, element: <Navigate to={ROUTES.dashboard} replace /> },
                  { path: ROUTES.dashboard, lazy: () => import('@/app/routes/dashboard') },
                  { path: ROUTES.pieces, lazy: () => import('@/app/routes/pieces') },
                  { path: ROUTES.prompts, lazy: () => import('@/app/routes/prompts') },
                  { path: ROUTES.reports, lazy: () => import('@/app/routes/reports') },

                  // Admin floor.
                  {
                    element: <RequireRole min={Role.Admin} />,
                    children: [
                      { path: ROUTES.users, lazy: () => import('@/app/routes/users') },
                      {
                        path: ROUTES.cardTemplates,
                        lazy: () => import('@/app/routes/card-templates'),
                      },
                      { path: ROUTES.languages, lazy: () => import('@/app/routes/languages') },
                      { path: ROUTES.featured, lazy: () => import('@/app/routes/featured') },
                      { path: ROUTES.analytics, lazy: () => import('@/app/routes/analytics') },
                      { path: ROUTES.auditLogs, lazy: () => import('@/app/routes/audit-logs') },
                      { path: ROUTES.settings, lazy: () => import('@/app/routes/settings') },
                      { path: ROUTES.aiSettings, lazy: () => import('@/app/routes/ai-settings') },
                      { path: ROUTES.moderators, lazy: () => import('@/app/routes/moderators') },
                      { path: ROUTES.systemInfo, lazy: () => import('@/app/routes/system-info') },
                      {
                        path: ROUTES.configHealth,
                        lazy: () => import('@/app/routes/config-health'),
                      },
                      {
                        path: ROUTES.infraHealth,
                        lazy: () => import('@/app/routes/infrastructure-health'),
                      },
                      { path: ROUTES.security, lazy: () => import('@/app/routes/security') },
                      { path: ROUTES.compliance, lazy: () => import('@/app/routes/compliance') },
                      { path: ROUTES.privacy, lazy: () => import('@/app/routes/privacy') },

                      // Operations console (P7.4).
                      { path: ROUTES.operations, lazy: () => import('@/app/routes/operations') },
                      {
                        path: ROUTES.incidents,
                        lazy: () => import('@/app/routes/operations-incidents'),
                      },
                      {
                        path: ROUTES.alerts,
                        lazy: () => import('@/app/routes/operations-alerts'),
                      },
                      {
                        path: ROUTES.tracing,
                        lazy: () => import('@/app/routes/operations-tracing'),
                      },
                      {
                        path: ROUTES.metrics,
                        lazy: () => import('@/app/routes/operations-metrics'),
                      },
                      { path: ROUTES.logs, lazy: () => import('@/app/routes/operations-logs') },
                      {
                        path: ROUTES.deployments,
                        lazy: () => import('@/app/routes/operations-deployments'),
                      },
                      { path: ROUTES.cost, lazy: () => import('@/app/routes/operations-cost') },
                      { path: ROUTES.slo, lazy: () => import('@/app/routes/operations-slo') },
                      {
                        path: ROUTES.serviceStatus,
                        lazy: () => import('@/app/routes/operations-status'),
                      },
                    ],
                  },

                  // Monetization (A1). Gated by PERMISSION rather than by rank: every
                  // `admin/monetization` endpoint carries `@Permissions(billing.manage)`, so the
                  // guard names the grant the server actually checks. `billing.*` sits on Admin
                  // today, so this selects the same viewers as the floor above — see
                  // `RequirePermission` for why it is still the right check to write.
                  {
                    element: <RequirePermission require={PERMISSIONS.BillingManage} />,
                    children: [
                      {
                        path: ROUTES.billingPlans,
                        lazy: () => import('@/app/routes/billing-plans'),
                      },
                      {
                        path: ROUTES.billingEntitlements,
                        lazy: () => import('@/app/routes/billing-entitlements'),
                      },
                      {
                        path: ROUTES.billingCoupons,
                        lazy: () => import('@/app/routes/billing-coupons'),
                      },
                      {
                        path: ROUTES.billingActions,
                        lazy: () => import('@/app/routes/billing-actions'),
                      },
                    ],
                  },

                  // Super-admin floor.
                  {
                    element: <RequireRole min={Role.SuperAdmin} />,
                    children: [{ path: ROUTES.roles, lazy: () => import('@/app/routes/roles') }],
                  },

                  { path: ROUTES.forbidden, element: <Forbidden /> },
                  { path: ROUTES.offline, element: <Offline /> },
                  { path: '*', element: <NotFound /> },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
]);
