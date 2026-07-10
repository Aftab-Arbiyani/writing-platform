import '@/styles/global.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router/dom';

import { AppProviders } from '@/app/providers';
import { router } from '@/app/router';
import { initSentry } from '@/app/sentry';

// Telemetry first (a no-op without a DSN) so early errors are captured (docs/00 §9).
initSentry();

const container = document.getElementById('root');

if (!container) {
  throw new Error('Root element "#root" not found — check index.html');
}

createRoot(container).render(
  <StrictMode>
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  </StrictMode>,
);
