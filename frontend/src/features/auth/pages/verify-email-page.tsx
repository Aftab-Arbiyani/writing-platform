import { QButton, QSpinner, useToast } from '@qalam/ui';
import { CheckCircle2, MailCheck, XCircle } from 'lucide-react';
import { useEffect, useRef, type ReactElement } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router';

import { usePageTitle } from '@/hooks/use-page-title';
import { getErrorMessage } from '@/lib/errors';
import { ROUTES } from '@/lib/routes';
import { useAuthStore } from '@/stores/auth.store';

import { AuthCard } from '../components/auth-card';
import { useResendVerification } from '../hooks/use-resend-verification';
import { useVerifyEmail } from '../hooks/use-verify-email';

/** Resend control — only functional while signed in (resend targets the current user). */
function ResendButton(): ReactElement {
  const toast = useToast();
  const resend = useResendVerification();
  return (
    <QButton
      variant="secondary"
      block
      loading={resend.isPending}
      onClick={() => {
        resend.mutate(undefined, {
          onSuccess: () => {
            toast.success('Verification email sent', { description: 'Check your inbox again.' });
          },
          onError: (err) => {
            toast.error('Couldn’t resend', { description: getErrorMessage(err) });
          },
        });
      }}
    >
      Resend verification email
    </QButton>
  );
}

export function VerifyEmailPage(): ReactElement {
  usePageTitle('Verify your email');
  const [params] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const token = params.get('token');
  const isAuthenticated = useAuthStore((s) => s.status === 'authenticated');
  const emailFromRegister = (location.state as { email?: string } | null)?.email;

  const verify = useVerifyEmail();
  const started = useRef(false);
  useEffect(() => {
    if (token && !started.current) {
      started.current = true;
      verify.mutate(token);
    }
  }, [token, verify]);

  // ── No token: verification-pending (just registered / opened the app to verify). ──────────
  if (!token) {
    return (
      <AuthCard
        title="Verify your email"
        subtitle={
          emailFromRegister ? (
            <>
              We’ve sent a verification link to{' '}
              <span className="font-medium text-ink">{emailFromRegister}</span>. Open it to confirm
              your address.
            </>
          ) : (
            'We’ve sent you a verification link. Open it to confirm your email address.'
          )
        }
        footer={
          <Link to={ROUTES.feed} className="font-medium text-accent hover:underline">
            Continue to Qalam
          </Link>
        }
      >
        <div className="flex justify-center py-2 text-accent">
          <MailCheck size={40} strokeWidth={1.25} aria-hidden />
        </div>
        {isAuthenticated ? (
          <ResendButton />
        ) : (
          <p className="text-center text-sm text-ink-secondary">
            Didn’t get it?{' '}
            <Link to={ROUTES.login} className="font-medium text-accent hover:underline">
              Sign in
            </Link>{' '}
            to resend the email.
          </p>
        )}
      </AuthCard>
    );
  }

  // ── Token present: verifying → success | failed. ──────────────────────────────────────────
  if (verify.isPending || verify.isIdle) {
    return (
      <AuthCard title="Verifying your email" subtitle="One moment…">
        <div className="flex justify-center py-4" role="status" aria-label="Verifying">
          <QSpinner />
        </div>
      </AuthCard>
    );
  }

  if (verify.isSuccess) {
    return (
      <AuthCard
        title="Email verified"
        subtitle="Thank you — your email address is confirmed. Everything on Qalam is open to you now."
      >
        <div className="flex justify-center py-2 text-success">
          <CheckCircle2 size={40} strokeWidth={1.25} aria-hidden />
        </div>
        <QButton
          variant="primary"
          size="lg"
          block
          onClick={() => {
            void navigate(isAuthenticated ? ROUTES.feed : ROUTES.login, { replace: true });
          }}
        >
          {isAuthenticated ? 'Continue to Qalam' : 'Sign in'}
        </QButton>
      </AuthCard>
    );
  }

  // Failed (invalid/expired/already-used token).
  return (
    <AuthCard
      title="Verification failed"
      subtitle={getErrorMessage(verify.error)}
      footer={
        <Link to={ROUTES.login} className="font-medium text-accent hover:underline">
          Back to sign in
        </Link>
      }
    >
      <div className="flex justify-center py-2 text-danger">
        <XCircle size={40} strokeWidth={1.25} aria-hidden />
      </div>
      {isAuthenticated ? (
        <ResendButton />
      ) : (
        <p className="text-center text-sm text-ink-secondary">
          Sign in and we’ll send a fresh verification link.
        </p>
      )}
    </AuthCard>
  );
}
