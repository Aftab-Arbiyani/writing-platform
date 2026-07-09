import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { AppProviders } from '@/app/providers';
import { AppRouter } from '@/app/router';
import { initSentry } from '@/app/sentry';

import '@/styles/global.css';

// Telemetry first (no-op without a DSN) so early errors are captured (docs/00 §9).
initSentry();

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root element #root not found — check index.html');
}

createRoot(container).render(
  <StrictMode>
    <AppProviders>
      <AppRouter />
    </AppProviders>
  </StrictMode>,
);
