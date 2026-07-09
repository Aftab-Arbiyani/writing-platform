import type { ReactElement } from 'react';
import { Link, Outlet } from 'react-router';

import { ROUTES } from '@/lib/routes';

/**
 * Auth corridor layout (docs/11 §3) — centered card, NO app chrome. "Auth is a corridor,
 * not a room" (docs/06 §3.7). Full split-panel treatment lands in the auth epic; F1 ships
 * the minimal centered shell the auth screens will render into.
 */
export function AuthLayout(): ReactElement {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-canvas px-4 py-10">
      <Link
        to={ROUTES.landing}
        className="font-serif text-2xl font-semibold text-ink"
        aria-label="Qalam home"
      >
        Qalam
      </Link>
      <div className="w-full max-w-[400px]">
        <Outlet />
      </div>
    </div>
  );
}
