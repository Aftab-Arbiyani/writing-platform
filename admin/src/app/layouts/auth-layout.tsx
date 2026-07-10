import type { ReactElement } from 'react';
import { Outlet } from 'react-router';

/**
 * Auth corridor (docs/11 §3) — a centered card on a plain canvas, no console chrome. Wraps the
 * guest branch (e.g. the future sign-in page). "Auth is a corridor, not a room."
 */
export function AuthLayout(): ReactElement {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-canvas p-4">
      <div className="w-full max-w-[400px]">
        <Outlet />
      </div>
    </div>
  );
}
