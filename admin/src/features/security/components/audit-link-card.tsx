import { QCard } from '@qalam/ui';
import { ArrowRight, ScrollText } from 'lucide-react';
import type { ReactElement } from 'react';
import { Link } from 'react-router';

import { ROUTES } from '@/lib/routes';

/**
 * A call-out linking to the existing Audit Logs browser (A6) filtered to a single audit category
 * (`security` or `privacy`). The security/privacy event feed is the audit log filtered by the P7.2
 * categories — we deliberately do NOT re-build the audit viewer here (docs P7.2), so this hands off
 * to the canonical browser with the category pre-selected in the URL.
 */
export interface AuditLinkCardProps {
  category: 'security' | 'privacy';
  title: string;
  description: string;
}

export function AuditLinkCard({ category, title, description }: AuditLinkCardProps): ReactElement {
  return (
    <QCard as="section" padding="lg">
      <Link
        to={`${ROUTES.auditLogs}?category=${category}`}
        className="flex items-center gap-4 text-ink no-underline"
      >
        <span className="flex size-10 flex-shrink-0 items-center justify-center rounded-md bg-raised">
          <ScrollText size={20} strokeWidth={1.75} className="text-accent" aria-hidden />
        </span>
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="text-sm font-semibold text-ink">{title}</span>
          <span className="text-sm text-ink-secondary">{description}</span>
        </span>
        <ArrowRight
          size={18}
          strokeWidth={1.75}
          className="ms-auto flex-shrink-0 text-ink-secondary"
          aria-hidden
        />
      </Link>
    </QCard>
  );
}
