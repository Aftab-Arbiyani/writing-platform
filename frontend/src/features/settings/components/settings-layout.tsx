import { cn } from '@qalam/ui';
import { Bell, CreditCard, Palette, ShieldCheck, ShieldOff, UserRound } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactElement } from 'react';
import { NavLink, Outlet } from 'react-router';

import { env } from '@/config/env';
import { ROUTES } from '@/lib/routes';

interface Section {
  to: string;
  label: string;
  icon: LucideIcon;
  /**
   * Whether the link matches its path exactly.
   *
   * Every section is a leaf and so matches exactly — except Billing, which is a hub with four child
   * routes (`/settings/billing/plans`, `…/usage`, `…/credits`, `…/history`). With `end`, opening one
   * of those would leave the whole section nav with nothing marked current, which loses the
   * `aria-current="page"` the nav relies on to say where the reader is.
   */
  end?: boolean;
}

const SECTIONS: readonly Section[] = [
  { to: ROUTES.settingsProfile, label: 'Profile', icon: UserRound },
  { to: ROUTES.settingsAccount, label: 'Account', icon: ShieldCheck },
  { to: ROUTES.settingsNotifications, label: 'Notifications', icon: Bell },
  { to: ROUTES.settingsAppearance, label: 'Appearance', icon: Palette },
];

/**
 * Safety (blocks/mutes + standing) is an AF6 W3c section, so it appears only while collaboration is
 * on — otherwise the tab would lead to a "Collaboration is off" panel.
 *
 * The flag is read from `env` rather than through collaboration's own `isCollaborationEnabled()`:
 * features may not import features (docs/26 §4), and one string comparison is a smaller price than
 * that edge. Both read the same variable, so they cannot disagree.
 */
const SAFETY_SECTION: Section = {
  to: ROUTES.settingsBlocks,
  label: 'Safety',
  icon: ShieldOff,
};

/**
 * Billing (plan, AI usage, credits, receipts) is an AF5 W4 section, so it appears only while
 * monetization is on — otherwise the tab would lead to a "Plans aren't available yet" panel.
 *
 * Read from `env` for the same reason as Safety above: features may not import features (docs/26 §4),
 * and one string comparison is a smaller price than that edge. It and monetization's own
 * `isMonetizationEnabled()` read the same variable, so they cannot disagree.
 *
 * Only the hub is listed. Its four sub-pages are reached from the hub, keeping this nav
 * one-entry-per-section — which is also why this entry alone sets `end: false`.
 */
const BILLING_SECTION: Section = {
  to: ROUTES.settingsBilling,
  label: 'Billing',
  icon: CreditCard,
  end: false,
};

// D5 removed the "AI" settings section that sat here. Nothing replaced it in this nav: the tools it
// fronted are reached from the editor, and the account-scoped pages it listed — conversations, the
// prompt library, token usage — are gone entirely.

/**
 * Settings shell (docs/06 §3.8, docs/11 §3): a 240px leading section-nav + content column at
 * `lg`, collapsing to a horizontal scroll nav above the content below `lg`. `NavLink` sets
 * `aria-current="page"` on the active section for free. Nested under `RequireAuth`; each section
 * renders through `<Outlet/>`.
 */
export function SettingsLayout(): ReactElement {
  const sections: readonly Section[] = [
    ...SECTIONS,
    ...(env.VITE_ENABLE_COLLABORATION === 'true' ? [SAFETY_SECTION] : []),
    ...(env.VITE_ENABLE_MONETIZATION === 'true' ? [BILLING_SECTION] : []),
  ];

  return (
    <div className="mx-auto w-full max-w-[960px] px-4 py-6 sm:px-6">
      <h1 className="mb-4 font-serif text-2xl font-semibold text-ink">Settings</h1>
      <div className="flex flex-col gap-6 lg:flex-row">
        <nav aria-label="Settings sections" className="lg:w-[240px] lg:shrink-0">
          <ul className="flex gap-1 overflow-x-auto border-b border-line pb-2 lg:flex-col lg:gap-0.5 lg:border-b-0 lg:pb-0">
            {sections.map(({ to, label, icon: Icon, end = true }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={end}
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
