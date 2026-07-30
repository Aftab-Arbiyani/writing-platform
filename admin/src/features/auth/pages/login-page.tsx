import { QCard } from '@qalam/ui';
import type { ReactElement } from 'react';
import { useLocation, useNavigate } from 'react-router';

import { usePageTitle } from '@/hooks/use-page-title';
import { ROUTES } from '@/lib/routes';

import { LoginForm } from '../components/login-form';

/**
 * Admin sign-in screen — rendered inside `AuthLayout` (centered card, no console chrome) behind the
 * `RequireGuest` gate. On success it redirects to the `returnTo` a guard captured (or the dashboard).
 */
export function LoginPage(): ReactElement {
  usePageTitle('Sign in');
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = (location.state as { returnTo?: string } | null)?.returnTo ?? ROUTES.dashboard;

  return (
    <QCard padding="lg" className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <span className="flex size-9 items-center justify-center rounded-md bg-accent text-base font-semibold text-[var(--q-accent-contrast,#fff)]">
          Q
        </span>
        <h1 className="text-xl font-semibold text-ink">Qalam Admin</h1>
        <p className="text-sm text-ink-secondary">Sign in to the operations console.</p>
      </div>
      <LoginForm onSuccess={() => void navigate(returnTo, { replace: true })} />
    </QCard>
  );
}
