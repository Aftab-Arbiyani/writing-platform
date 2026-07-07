import type { ReactElement } from 'react';

import { Link } from 'react-router';

// Default export: route pages are default-exported for React Router lazy()
// code-splitting in Phase 1 (see placeholder-home.tsx).
export default function NotFound(): ReactElement {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-canvas ps-6 pe-6 text-center">
      <p className="text-sm text-ink-muted">404</p>
      <h1 className="mt-2 font-serif text-3xl text-ink">This page does not exist</h1>
      <Link
        to="/"
        className="mt-6 text-accent underline underline-offset-4 hover:text-accent-hover"
      >
        Return home
      </Link>
    </main>
  );
}
