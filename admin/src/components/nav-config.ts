import { Role } from '@qalam/shared';
import {
  Activity,
  BarChart3,
  BellRing,
  DollarSign,
  FileText,
  Flag,
  Gauge,
  HeartPulse,
  KeyRound,
  Languages,
  LayoutDashboard,
  LayoutTemplate,
  Lock,
  Rocket,
  Scale,
  ScrollText,
  Server,
  ShieldAlert,
  ShieldCheck,
  Siren,
  SlidersHorizontal,
  Sparkles,
  Star,
  Target,
  TrendingUp,
  Users,
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
