import { Role } from '@qalam/shared';
import {
  Activity,
  BadgeCheck,
  Banknote,
  BarChart3,
  BellRing,
  CircleDollarSign,
  Coins,
  DollarSign,
  FileText,
  Flag,
  Gauge,
  Gavel,
  HeartPulse,
  KeyRound,
  Languages,
  LayoutDashboard,
  LayoutTemplate,
  Lock,
  Repeat,
  Radar,
  Rocket,
  Scale,
  ScrollText,
  Search,
  Server,
  ShieldAlert,
  ShieldCheck,
  Siren,
  SlidersHorizontal,
  Sparkles,
  Star,
  Target,
  Ticket,
  TrendingUp,
  Users,
  Wallet,
  Waypoints,
  type LucideIcon,
} from 'lucide-react';

import { ROUTES } from '@/lib/routes';

/**
 * The admin side-nav map (docs/10 §3.4, docs/11 §2/§8) — grouped sections, each item gated by a
 * minimum role FLOOR. The sidebar renders only the groups/items the viewer's role can enter (a
 * moderator never sees `/roles`). This is a UX-hint layer only: the server re-checks every endpoint.
 * All sections are placeholder routes in A1; feature epics own their pages.
 */
export interface NavItem {
  key: string;
  label: string;
  path: string;
  icon: LucideIcon;
  minRole: Role;
}

export interface NavGroup {
  key: string;
  label: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    key: 'overview',
    label: 'Overview',
    items: [
      {
        key: 'dashboard',
        label: 'Dashboard',
        path: ROUTES.dashboard,
        icon: LayoutDashboard,
        minRole: Role.Moderator,
      },
    ],
  },
  {
    key: 'content',
    label: 'Content',
    items: [
      {
        key: 'pieces',
        label: 'Pieces',
        path: ROUTES.pieces,
        icon: FileText,
        minRole: Role.Moderator,
      },
      {
        key: 'prompts',
        label: 'Prompts',
        path: ROUTES.prompts,
        icon: Sparkles,
        minRole: Role.Moderator,
      },
      {
        key: 'card-templates',
        label: 'Card templates',
        path: ROUTES.cardTemplates,
        icon: LayoutTemplate,
        minRole: Role.Admin,
      },
      {
        key: 'languages',
        label: 'Languages',
        path: ROUTES.languages,
        icon: Languages,
        minRole: Role.Admin,
      },
      {
        key: 'featured',
        label: 'Featured',
        path: ROUTES.featured,
        icon: Star,
        minRole: Role.Admin,
      },
    ],
  },
  {
    key: 'moderation',
    label: 'Moderation',
    items: [
      {
        key: 'reports',
        label: 'Reports',
        path: ROUTES.reports,
        icon: Flag,
        minRole: Role.Moderator,
      },
      /**
       * Trust & safety (A2). `minRole: Role.Moderator` is the `trust.view` gate expressed in the
       * shape this map has (a role FLOOR, not a permission code): `trust.*` is granted to Moderator
       * and, by rank inheritance, to Admin and SuperAdmin — so the floor selects exactly the viewers
       * who hold the grant. The ROUTE carries `RequirePermission(trust.view)`, which is the check
       * the server makes; the equivalence is stated here rather than by adding a `permission` field
       * to all 30-odd entries, as A1 decided for the billing rows.
       */
      {
        key: 'trust',
        label: 'Trust & safety',
        path: ROUTES.trust,
        icon: Gavel,
        minRole: Role.Moderator,
      },
    ],
  },
  {
    key: 'platform',
    label: 'Platform',
    items: [
      {
        key: 'analytics',
        label: 'Analytics',
        path: ROUTES.analytics,
        icon: BarChart3,
        minRole: Role.Admin,
      },
      {
        key: 'audit-logs',
        label: 'Audit logs',
        path: ROUTES.auditLogs,
        icon: ScrollText,
        minRole: Role.Admin,
      },
      {
        key: 'settings',
        label: 'Settings',
        path: ROUTES.settings,
        icon: SlidersHorizontal,
        minRole: Role.Admin,
      },
      {
        key: 'ai-settings',
        label: 'AI Defaults',
        path: ROUTES.aiSettings,
        icon: Sparkles,
        minRole: Role.Admin,
      },
      /**
       * AI retrieval admin (A3). `minRole: Role.Admin` is the `ai.manage` gate in the shape this map
       * has — nav items carry a role FLOOR, not a permission code, and `ai.*` is granted to Admin and
       * SuperAdmin only, so a moderator never sees these. Same equivalence the billing rows below
       * state for `billing.manage`.
       */
      {
        key: 'ai-search-config',
        label: 'Retrieval config',
        path: ROUTES.aiSearchConfig,
        icon: Radar,
        minRole: Role.Admin,
      },
      {
        key: 'ai-search-analytics',
        label: 'Search analytics',
        path: ROUTES.aiSearchAnalytics,
        icon: Search,
        minRole: Role.Admin,
      },
      /**
       * Monetization (A1). `minRole: Role.Admin` is the `billing.manage` gate expressed in the shape
       * this map has: nav items carry a role FLOOR, not a permission code, and `billing.*` is granted
       * to Admin and SuperAdmin only (`permissions.ts` DEFAULT_ROLE_PERMISSIONS) — so a moderator,
       * who holds no billing grant, does not see these. The ROUTES are guarded by
       * `RequirePermission(billing.manage)`, which is the check the server actually makes; adding a
       * `permission` field here would mean rewriting all 30-odd existing entries inside a
       * monetization row, so the shape is left alone and the equivalence is stated instead.
       */
      {
        key: 'billing-plans',
        label: 'Plans & pricing',
        path: ROUTES.billingPlans,
        icon: Wallet,
        minRole: Role.Admin,
      },
      {
        key: 'billing-entitlements',
        label: 'Entitlements',
        path: ROUTES.billingEntitlements,
        icon: BadgeCheck,
        minRole: Role.Admin,
      },
      {
        key: 'billing-coupons',
        label: 'Coupons',
        path: ROUTES.billingCoupons,
        icon: Ticket,
        minRole: Role.Admin,
      },
      {
        key: 'billing-actions',
        label: 'Billing actions',
        path: ROUTES.billingActions,
        icon: Coins,
        minRole: Role.Admin,
      },
      {
        key: 'billing-revenue',
        label: 'Revenue',
        path: ROUTES.billingRevenue,
        icon: Banknote,
        minRole: Role.Admin,
      },
      {
        key: 'billing-subscriptions',
        label: 'Subscriptions',
        path: ROUTES.billingSubscriptions,
        icon: Repeat,
        minRole: Role.Admin,
      },
      {
        key: 'billing-usage',
        label: 'AI usage & cost',
        path: ROUTES.billingUsage,
        icon: CircleDollarSign,
        minRole: Role.Admin,
      },
    ],
  },
  {
    key: 'system',
    label: 'System',
    items: [
      {
        key: 'system-info',
        label: 'System info',
        path: ROUTES.systemInfo,
        icon: Server,
        minRole: Role.Admin,
      },
      {
        key: 'config-health',
        label: 'Config health',
        path: ROUTES.configHealth,
        icon: ShieldCheck,
        minRole: Role.Admin,
      },
      {
        key: 'infra-health',
        label: 'Infrastructure',
        path: ROUTES.infraHealth,
        icon: Activity,
        minRole: Role.Admin,
      },
      {
        key: 'security',
        label: 'Security',
        path: ROUTES.security,
        icon: ShieldAlert,
        minRole: Role.Admin,
      },
      {
        key: 'compliance',
        label: 'Compliance',
        path: ROUTES.compliance,
        icon: Scale,
        minRole: Role.Admin,
      },
      {
        key: 'privacy',
        label: 'Privacy',
        path: ROUTES.privacy,
        icon: Lock,
        minRole: Role.Admin,
      },
    ],
  },
  {
    key: 'operations',
    label: 'Operations',
    items: [
      {
        key: 'operations',
        label: 'Overview',
        path: ROUTES.operations,
        icon: Gauge,
        minRole: Role.Admin,
      },
      {
        key: 'incidents',
        label: 'Incidents',
        path: ROUTES.incidents,
        icon: Siren,
        minRole: Role.Admin,
      },
      {
        key: 'alerts',
        label: 'Alerts',
        path: ROUTES.alerts,
        icon: BellRing,
        minRole: Role.Admin,
      },
      {
        key: 'tracing',
        label: 'Tracing',
        path: ROUTES.tracing,
        icon: Waypoints,
        minRole: Role.Admin,
      },
      {
        key: 'metrics',
        label: 'Metrics',
        path: ROUTES.metrics,
        icon: TrendingUp,
        minRole: Role.Admin,
      },
      {
        key: 'logs',
        label: 'Logs',
        path: ROUTES.logs,
        icon: ScrollText,
        minRole: Role.Admin,
      },
      {
        key: 'deployments',
        label: 'Deployments',
        path: ROUTES.deployments,
        icon: Rocket,
        minRole: Role.Admin,
      },
      {
        key: 'cost',
        label: 'Cost',
        path: ROUTES.cost,
        icon: DollarSign,
        minRole: Role.Admin,
      },
      {
        key: 'slo',
        label: 'SLOs',
        path: ROUTES.slo,
        icon: Target,
        minRole: Role.Admin,
      },
      {
        key: 'service-status',
        label: 'Service status',
        path: ROUTES.serviceStatus,
        icon: HeartPulse,
        minRole: Role.Admin,
      },
    ],
  },
  {
    key: 'access',
    label: 'Access',
    items: [
      { key: 'users', label: 'Users', path: ROUTES.users, icon: Users, minRole: Role.Admin },
      {
        key: 'moderators',
        label: 'Moderators',
        path: ROUTES.moderators,
        icon: ShieldCheck,
        minRole: Role.Admin,
      },
      {
        key: 'roles',
        label: 'Roles',
        path: ROUTES.roles,
        icon: KeyRound,
        minRole: Role.SuperAdmin,
      },
    ],
  },
];

/** A flat list of every nav item (for breadcrumb lookup + route generation). */
export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((group) => group.items);
