import { AppealStatus, PERMISSIONS } from '@qalam/shared';
import { QButton, useToast } from '@qalam/ui';
import { Descriptions, Input } from 'antd';
import { useState, type ReactElement, type ReactNode } from 'react';

import { Drawer } from '@/components/drawer';
import { LoadingState } from '@/components/loading-state';
import { usePermissions } from '@/hooks/use-permissions';
import { getErrorMessage } from '@/lib/errors';
import { formatDateTime } from '@/lib/format';

import { useAppeal } from '../hooks/use-appeals';
import { useApproveAppeal, useRejectAppeal } from '../hooks/use-moderation-mutations';
import { REASON_LABELS, TYPE_LABELS } from '../moderation.constants';
import { ModerationTimeline } from './moderation-timeline';

interface AppealDrawerProps {
  appealId: string | null;
  onClose: () => void;
}

/** The appeal detail drawer — reason, its report, the combined timeline, and approve/reject. */
export function AppealDetailDrawer({ appealId, onClose }: AppealDrawerProps): ReactElement {
  const { can } = usePermissions();
  const toast = useToast();
  const detail = useAppeal(appealId);
  const approve = useApproveAppeal();
  const reject = useRejectAppeal();
  const [notes, setNotes] = useState('');

  const decide = (mutation: typeof approve, label: string): void => {
    if (appealId === null) {
      return;
    }
    mutation.mutate(
      { id: appealId, notes: notes.trim() || undefined },
      {
        onSuccess: () => {
          toast.success(`Appeal ${label}.`);
          setNotes('');
          onClose();
        },
        onError: (error) => toast.error(getErrorMessage(error)),
      },
    );
  };

  let body: ReactNode = null;
  if (appealId !== null && detail.isLoading) {
    body = <LoadingState variant="rows" rows={6} />;
  } else if (detail.isError) {
    body = <p className="text-sm text-danger">{getErrorMessage(detail.error)}</p>;
  } else if (detail.data !== undefined) {
    const data = detail.data;
    const pending = data.status === AppealStatus.Pending;
    body = (
      <div className="flex flex-col gap-5">
        <Descriptions
          column={1}
          size="small"
          items={[
            { key: 'status', label: 'Appeal status', children: data.status },
            { key: 'appellant', label: 'Appellant', children: data.appellantId },
            { key: 'filed', label: 'Filed', children: formatDateTime(data.createdAt) },
            {
              key: 'report',
              label: 'Report',
              children: `${TYPE_LABELS[data.report.entityType] ?? data.report.entityType} · ${
                REASON_LABELS[data.report.reason] ?? data.report.reason
              } · ${data.report.resolution ?? '—'}`,
            },
          ]}
        />
        <section className="flex flex-col gap-1">
          <h3 className="text-sm font-semibold text-ink">Appeal reason</h3>
          <p className="text-sm text-ink">{data.reason}</p>
        </section>

        {can(PERMISSIONS.ReportResolve) && pending ? (
          <section className="flex flex-col gap-2">
            <Input.TextArea
              rows={2}
              maxLength={2000}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Reviewer notes (optional)…"
            />
            <div className="flex gap-2">
              <QButton
                variant="primary"
                size="sm"
                loading={approve.isPending}
                onClick={() => decide(approve, 'approved')}
              >
                Approve &amp; restore
              </QButton>
              <QButton
                variant="danger"
                size="sm"
                loading={reject.isPending}
                onClick={() => decide(reject, 'rejected')}
              >
                Reject
              </QButton>
            </div>
          </section>
        ) : data.reviewNotes !== null ? (
          <section className="flex flex-col gap-1">
            <h3 className="text-sm font-semibold text-ink">Reviewer notes</h3>
            <p className="text-sm text-ink">{data.reviewNotes}</p>
          </section>
        ) : null}

        <section className="flex flex-col gap-1">
          <h3 className="text-sm font-semibold text-ink">Timeline</h3>
          <ModerationTimeline entries={data.timeline} />
        </section>
      </div>
    );
  }

  return (
    <Drawer open={appealId !== null} onClose={onClose} width={600} title="Appeal detail">
      {body}
    </Drawer>
  );
}
