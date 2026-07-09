import { cn } from '@qalam/ui';
import { Palette, ShieldCheck, UserRound } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactElement } from 'react';
import { NavLink, Outlet } from 'react-router';

import { ROUTES } from '@/lib/routes';

const SECTIONS: readonly { to: string; label: string; icon: LucideIcon }[] = [
  { to: ROUTES.settingsProfile, label: 'Profile', icon: UserRound },
  { to: ROUTES.settingsAccount, label: 'Account', icon: ShieldCheck },
  { to: ROUTES.settingsAppearance, label: 'Appearance', icon: Palette },
];

/**
 * Settings shell (docs/06 §3.8, docs/11 §3): a 240px leading section-nav + content column at
 * `lg`, collapsing to a horizontal scroll nav above the content below `lg`. `NavLink` sets
 * `aria-current="page"` on the active section for free. Nested under `RequireAuth`; each section
 * renders through `<Outlet/>`.
 */
export function SettingsLayout(): ReactElement {
  return (
    <div className="mx-auto w-full max-w-[960px] px-4 py-6 sm:px-6">
      <h1 className="mb-4 font-serif text-2xl font-semibold text-ink">Settings</h1>
      <div className="flex flex-col gap-6 lg:flex-row">
        <nav aria-label="Settings sections" className="lg:w-[240px] lg:shrink-0">
          <ul className="flex gap-1 overflow-x-auto border-b border-line pb-2 lg:flex-col lg:gap-0.5 lg:border-b-0 lg:pb-0">
            {SECTIONS.map(({ to, label, icon: Icon }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end
                  className={({ isActive }) =>
                    cn(
                      'flex min-h-11 items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent',
                      isActive
                        ? 'bg-raised font-medium text-ink'
                        : 'text-ink-secondary hover:text-ink',
                    )
                  }
                >
                  <Icon size={18} strokeWidth={1.5} aria-hidden />
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="min-w-0 flex-1">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
