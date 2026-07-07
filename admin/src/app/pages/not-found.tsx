import { Link } from 'react-router';

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-[var(--q-bg-canvas)] p-8 text-center">
      <p className="text-sm font-medium tracking-widest text-[var(--q-text-muted)]">404</p>
      <h1 className="text-xl font-semibold text-[var(--q-text-primary)]">Page not found</h1>
      <p className="text-sm text-[var(--q-text-secondary)]">
        This admin route does not exist (yet).
      </p>
      <Link
        to="/"
        className="text-sm font-medium text-[var(--q-accent)] hover:text-[var(--q-accent-hover)]"
      >
        Back to dashboard
      </Link>
    </main>
  );
}
