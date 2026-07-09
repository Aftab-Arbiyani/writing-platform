import { QButton, QSearch } from '@qalam/ui';
import { PenLine } from 'lucide-react';
import type { ReactElement } from 'react';
import { Link, useNavigate } from 'react-router';

import { ThemeToggle } from '@/components/theme-toggle';
import { ROUTES } from '@/lib/routes';

/**
 * Desktop/mobile top bar (docs/06 §2, docs/10 §3.1): wordmark → center search → Write CTA +
 * theme toggle. World-facing actions only; self-referential nav lives in the user menu
 * (a feature epic). No business menus yet. Search is a disabled placeholder in F1.
 */
export function TopBar(): ReactElement {
  const navigate = useNavigate();
  return (
    <header className="border-line sticky top-0 z-[1020] border-b bg-canvas/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[1280px] items-center gap-3 px-4 sm:h-16 sm:px-6">
        <Link
          to={ROUTES.landing}
          className="font-serif text-xl font-semibold text-ink"
          aria-label="Qalam home"
        >
          Qalam
        </Link>
        <div className="hidden flex-1 justify-center md:flex">
          <div className="w-full max-w-[480px]">
            <QSearch placeholder="Search writers, pieces, tags…" disabled aria-label="Search" />
          </div>
        </div>
        <div className="ms-auto flex items-center gap-1">
          <ThemeToggle />
          <QButton
            variant="primary"
            size="sm"
            icon={PenLine}
            onClick={() => {
              void navigate(ROUTES.write);
            }}
          >
            Write
          </QButton>
        </div>
      </div>
    </header>
  );
}
