import type { ReactElement } from 'react';
import { Outlet } from 'react-router';

import { SessionExpiredDialog } from '@/features/auth';

/**
 * Router-root layout wrapping BOTH the guest and authenticated branches. Its only job is to mount the
 * global `SessionExpiredDialog` once, inside the router (so it can navigate), above every page — an
 * expired session must be able to interrupt regardless of which branch is active.
 */
export function AppRoot(): ReactElement {
  return (
    <>
      <SessionExpiredDialog />
      <Outlet />
    </>
  );
}
