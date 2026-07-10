import { QButton } from '@qalam/ui';
import { useQueryClient } from '@tanstack/react-query';
import type { ReactElement } from 'react';
import { useNavigate } from 'react-router';

import { Modal } from '@/components/modal';
import { ROUTES } from '@/lib/routes';
import { useAuthStore } from '@/stores/auth.store';

/**
 * Session-expired handling (docs/32 §3.2). Mounted once at the app root; appears when the api-client's
 * unauthorized handler raised `sessionExpired` on an unrecoverable 401 (automatic logout). It is a
 * blocking, non-dismissable dialog (`danger` disables Esc/mask) — the only way out is to sign in
 * again, which clears the session and routes to /login. This is the "Session Expired" screen.
 */
export function SessionExpiredDialog(): ReactElement | null {
  const sessionExpired = useAuthStore((state) => state.sessionExpired);
  const clear = useAuthStore((state) => state.clear);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  if (!sessionExpired) return null;

  const signInAgain = (): void => {
    clear();
    queryClient.clear(); // drop the previous operator's cached data before returning to login
    navigate(ROUTES.login, { replace: true });
  };

  return (
    <Modal
      open
      onClose={() => {
        /* non-dismissable — must choose to sign in */
      }}
      title="Your session has expired"
      size="sm"
      danger
      footer={
        <QButton variant="primary" onClick={signInAgain}>
          Sign in again
        </QButton>
      }
    >
      <p className="text-sm text-ink-secondary">
        For your security you’ve been signed out. Please sign in again to continue.
      </p>
    </Modal>
  );
}
