import { QButton, QSpinner } from '@qalam/ui';
import { XCircle } from 'lucide-react';
import { useEffect, useRef, type ReactElement } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

import { usePageTitle } from '@/hooks/use-page-title';
import { ROUTES } from '@/lib/routes';

import { AuthCard } from '../components/auth-card';
import { useGoogleExchange } from '../hooks/use-google-exchange';
import { takeGoogleReturnTo } from '../lib/google';

/**
 * Google OAuth landing (`/auth/callback?code=`). Exchanges the one-time code for an access
 * token (docs/32 §3.3). A missing code or an `?error=` (the user cancelled at Google) → failure
 * with a route back to sign in. On success we navigate to the stashed returnTo (or /feed).
 */
export function GoogleCallbackPage(): ReactElement {
  usePageTitle('Signing you in');
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const code = params.get('code');
  const errorParam = params.get('error');
  const exchange = useGoogleExchange();

  const started = useRef(false);
  useEffect(() => {
    if (code && !errorParam && !started.current) {
      started.current = true;
      exchange.mutate(code);
    }
  }, [code, errorParam, exchange]);

  useEffect(() => {
    if (exchange.isSuccess) {
      void navigate(takeGoogleReturnTo() ?? ROUTES.feed, { replace: true });
    }
  }, [exchange.isSuccess, navigate]);

  const failed = !code || Boolean(errorParam) || exchange.isError;

  if (failed) {
    return (
      <AuthCard
        title="Google sign-in didn’t work"
        subtitle="We couldn’t complete sign-in with Google. Please try again, or use your email and password."
      >
        <div className="flex justify-center py-2 text-danger">
          <XCircle size={40} strokeWidth={1.25} aria-hidden />
        </div>
        <QButton
          variant="primary"
          size="lg"
          block
          onClick={() => {
            void navigate(ROUTES.login, { replace: true });
          }}
        >
          Back to sign in
        </QButton>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Signing you in" subtitle="Finishing up with Google…">
      <div className="flex justify-center py-4" role="status" aria-label="Signing in">
        <QSpinner />
      </div>
    </AuthCard>
  );
}
