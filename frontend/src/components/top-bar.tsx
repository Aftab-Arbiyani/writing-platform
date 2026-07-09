import { QButton, QSearch } from '@qalam/ui';
import { LogOut, PenLine } from 'lucide-react';
import type { ReactElement } from 'react';
import { Link, useNavigate } from 'react-router';

import { ThemeToggle } from '@/components/theme-toggle';
import { useLogout } from '@/features/auth/hooks/use-logout';
import { ROUTES } from '@/lib/routes';
import { useAuthStore } from '@/stores/auth.store';

/**
 * Desktop/mobile top bar (docs/06 §2, docs/10 §3.1): wordmark → center search → Write CTA +
 * theme toggle. World-facing actions only; the rich user menu lives in a later epic. The auth
 * epic adds the minimal session affordance: Sign in when anonymous, Sign out when signed in.
 * Search is a disabled placeholder until the search epic.
 */
export function TopBar(): ReactElement {
  const navigate = useNavigate();
  const status = useAuthStore((s) => s.status);
  const logout = useLogout();

  const onSignOut = (): void => {
    logout.mutate(undefined, {
      onSettled: () => {
        void navigate(ROUTES.landing, { replace: true });
      },
    });
  };

  return (
    <header className="border-line sticky top-0 z-[1020] border-b bg-canvas/95 backdrop-blur">
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
            <QSearch placeholder="Search writers, pieces, tags…" disabled aria-label="Search" />
          </div>
        </div>
        <div className="ms-auto flex items-center gap-1">
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
          {status === 'authenticated' ? (
            <QButton
              variant="ghost"
              size="sm"
              className="hidden sm:inline-flex"
              onClick={() => {
                void navigate(ROUTES.drafts);
              }}
            >
              Your writing
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
          {status === 'authenticated' ? (
            <QButton
              variant="ghost"
              size="sm"
              icon={LogOut}
              loading={logout.isPending}
              onClick={onSignOut}
              aria-label="Sign out"
            />
          ) : null}
        </div>
      </div>
    </header>
  );
}
