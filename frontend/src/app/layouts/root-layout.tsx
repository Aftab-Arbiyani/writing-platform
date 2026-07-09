import { pageTransition } from '@qalam/ui/motion';
import { motion } from 'framer-motion';
import type { ReactElement } from 'react';
import { Outlet, ScrollRestoration, useLocation } from 'react-router';

import { Footer } from '@/components/footer';
import { MobileTabBar } from '@/components/mobile-tab-bar';
import { OfflineBanner } from '@/components/offline-banner';
import { SkipLink } from '@/components/skip-link';
import { TopBar } from '@/components/top-bar';

/**
 * The reader/writer app shell (docs/06 §2, docs/11 §3) — the only place app chrome renders.
 * Top bar + mobile bottom tab bar + right-rail slot (feature-provided) + scroll restoration.
 * No left sidebar / breadcrumbs — that is the admin app's pattern (docs/10 §4). Public and
 * authenticated routes share this shell; the RequireAuth guard gates the authed ones.
 */
export function RootLayout(): ReactElement {
  const location = useLocation();
  return (
    <div className="flex min-h-dvh flex-col">
      <SkipLink />
      <TopBar />
      <OfflineBanner />
      <main id="main" tabIndex={-1} className="flex-1 pb-16 outline-none md:pb-0">
        {/* Enter-only page transition; fades, never slides (docs/07 §14). Reduced motion via MotionProvider. */}
        <motion.div
          key={location.pathname}
          variants={pageTransition}
          initial="initial"
          animate="animate"
        >
          <Outlet />
        </motion.div>
      </main>
      <Footer />
      <MobileTabBar />
      <ScrollRestoration />
    </div>
  );
}
