import { Bell, House, PenLine, Search, User } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactElement } from 'react';
import { NavLink } from 'react-router';

import { ROUTES } from '@/lib/routes';

interface TabItem {
  to: string;
  label: string;
  icon: LucideIcon;
  accent?: boolean;
}

// Five thumb-reachable destinations (docs/06 §2, docs/10 §3.3). Write keeps its center slot.
const ITEMS: readonly TabItem[] = [
  { to: ROUTES.feed, label: 'Home', icon: House },
  { to: ROUTES.search, label: 'Search', icon: Search },
  { to: ROUTES.write, label: 'Write', icon: PenLine, accent: true },
  { to: ROUTES.notifications, label: 'Alerts', icon: Bell },
  { to: ROUTES.settings, label: 'You', icon: User },
];

/** Mobile bottom tab bar (< md). Hidden on desktop, where the top bar carries nav. */
export function MobileTabBar(): ReactElement {
  return (
    <nav
      aria-label="Primary"
      className="border-line fixed inset-x-0 bottom-0 z-[1020] border-t bg-canvas pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="mx-auto flex max-w-[720px] items-stretch justify-around">
        {ITEMS.map(({ to, label, icon: Icon, accent }) => (
          <li key={to}>
            <NavLink
              to={to}
              className={({ isActive }) =>
                [
                  'flex min-h-11 flex-col items-center justify-center gap-0.5 px-3 py-2 text-xs',
                  accent ? 'text-accent' : isActive ? 'text-ink' : 'text-ink-secondary',
                ].join(' ')
              }
            >
              <Icon size={22} strokeWidth={1.5} aria-hidden />
              <span>{label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
