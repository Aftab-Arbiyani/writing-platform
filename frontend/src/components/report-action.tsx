import type { ReportEntityType } from '@qalam/shared';
import { QButton, type QButtonSize, type QButtonVariant } from '@qalam/ui';
import { Flag } from 'lucide-react';
import { type ReactElement, useState } from 'react';
import { useNavigate } from 'react-router';

import { ROUTES } from '@/lib/routes';
import { useAuthStore } from '@/stores/auth.store';

import { ReportDialog } from './report-dialog';

/**
 * A "Report" trigger plus the dialog it opens (W7b) — the piece every mount point actually uses, so
 * that four surfaces do not each re-implement open-state and sign-in gating.
 *
 * Reporting needs a session (`POST /reports` is authenticated), so a signed-out reader is routed to
 * sign-in with `returnTo` — the SAME path like, bookmark and clap take, rather than a second one.
 *
 * `asMenuItem` renders the trigger as a plain full-width row for use inside a dropdown or a list,
 * where a bordered button would look wrong; everything else about the flow is identical.
 */
export interface ReportActionProps {
  entityType: ReportEntityType;
  entityId: string;
  /** What is being reported, for the dialog title — e.g. "this piece", "@meera_k". */
  subject: string;
  /** Where sign-in returns a signed-out reader. Defaults to the current URL. */
  returnTo?: string;
  label?: string;
  variant?: QButtonVariant;
  size?: QButtonSize;
  asMenuItem?: boolean;
}

export function ReportAction({
  entityType,
  entityId,
  subject,
  returnTo,
  label = 'Report',
  variant = 'ghost',
  size = 'sm',
  asMenuItem = false,
}: ReportActionProps): ReactElement {
  const [open, setOpen] = useState(false);
  const authed = useAuthStore((s) => s.status) === 'authenticated';
  const navigate = useNavigate();

  const onTrigger = (): void => {
    if (!authed) {
      const target = returnTo ?? `${window.location.pathname}${window.location.search}`;
      void navigate(`${ROUTES.login}?returnTo=${encodeURIComponent(target)}`);
      return;
    }
    setOpen(true);
  };

  return (
    <>
      {asMenuItem ? (
        <button
          type="button"
          onClick={onTrigger}
          className="text-ink hover:bg-raised flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-start text-sm"
        >
          <Flag size={16} strokeWidth={1.5} aria-hidden />
          {label}
        </button>
      ) : (
        <QButton variant={variant} size={size} icon={Flag} onClick={onTrigger}>
          {label}
        </QButton>
      )}

      {/* Mounted only while open: `QDialog` has `destroyOnHidden`, but keeping the component out of
          the tree entirely means a thread of forty comments carries no dialog state at all. */}
      {open ? (
        <ReportDialog
          open
          onClose={() => setOpen(false)}
          entityType={entityType}
          entityId={entityId}
          subject={subject}
        />
      ) : null}
    </>
  );
}
