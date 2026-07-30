import { QButton } from '@qalam/ui';
import { PenLine } from 'lucide-react';
import type { ReactElement } from 'react';
import { Link, useNavigate } from 'react-router';

import { ThemeToggle } from '@/components/theme-toggle';
import { UserMenu } from '@/components/user-menu';
import { NotificationBell } from '@/features/notifications';
import { CommandTrigger } from '@/features/search';
import { ROUTES } from '@/lib/routes';
import { useAuthStore } from '@/stores/auth.store';

/**
 * Desktop/mobile top bar (docs/06 §2, docs/10 §3.1): wordmark → center search → Write CTA +
 * theme toggle. Signed-in users get the account menu (profile, writing, requests, settings, sign
 * out); anonymous visitors get a Sign in button. The centered search box opens the ⌘K/Ctrl+K
 * command palette (md+); mobile reaches search via the bottom tab bar.
 */
export function TopBar(): ReactElement {
  const navigate = useNavigate();
  const status = useAuthStore((s) => s.status);

  return (
    <header
      data-print-hidden
      className="border-line sticky top-0 z-[1020] border-b bg-canvas/95 backdrop-blur"
    >
      <div className="mx-auto flex h-14 max-w-[1280px] items-center gap-3 px-4 sm:h-16 sm:px-6">
        <Link
          to={ROUTES.landing}
          className="font-serif text-xl font-semibold text-ink"
          aria-label="Qalam home"
        >
          Qalam
        </Link>
        <div className="hidden flex-1 justify-center md:flex">
          <div className="w-full max-w-[480px]">
            <CommandTrigger />
          </div>
        </div>
        <div className="ms-auto flex items-center gap-1">
          {status === 'authenticated' ? (
            <div className="hidden md:block">
              <NotificationBell />
            </div>
          ) : null}
          <ThemeToggle />
          {status === 'anonymous' ? (
            <QButton
              variant="secondary"
              size="sm"
              onClick={() => {
                void navigate(ROUTES.login);
              }}
            >
              Sign in
            </QButton>
          ) : null}
          <QButton
            variant="primary"
            size="sm"
            icon={PenLine}
            onClick={() => {
              void navigate(ROUTES.write);
            }}
          >
            Write
          </QButton>
          {status === 'authenticated' ? <UserMenu /> : null}
        </div>
      </div>
    </header>
  );
}
