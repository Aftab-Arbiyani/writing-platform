import { Breadcrumb } from 'antd';
import { Home } from 'lucide-react';
import type { ReactElement } from 'react';
import { Link, useLocation } from 'react-router';

import { NAV_ITEMS } from '@/components/nav-config';
import { ROUTES } from '@/lib/routes';

/**
 * Location breadcrumbs for the header. The admin sitemap is flat (docs/10 §2), so a trail is at most
 * Dashboard → {Section}; the home crumb always links back to the dashboard. Breadcrumbs are an
 * implementer choice here (docs never mandate them for admin) — they aid orientation in a console.
 */
export function AppBreadcrumbs(): ReactElement {
  const location = useLocation();
  const section = NAV_ITEMS.find((item) => location.pathname.startsWith(item.path));

  const items = [
    {
      title: (
        <Link to={ROUTES.dashboard} aria-label="Dashboard">
          <Home size={14} aria-hidden />
        </Link>
      ),
    },
    ...(section && section.path !== ROUTES.dashboard ? [{ title: section.label }] : []),
  ];

  return <Breadcrumb items={items} />;
}
