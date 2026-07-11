import { PERMISSIONS, ReportResolution } from '@qalam/shared';
import type { ReportSeverity } from '@qalam/shared';
import { QButton, useToast } from '@qalam/ui';
import { Input, Select } from 'antd';
import { useState, type ReactElement } from 'react';

import { Modal } from '@/components/modal';
import { usePermissions } from '@/hooks/use-permissions';
import { getErrorMessage } from '@/lib/errors';

import { useResolveReport } from '../hooks/use-moderation-mutations';
import { RESOLUTION_OPTIONS, SEVERITY_OPTIONS } from '../moderation.constants';
import type { Report } from '../types/moderation.types';

const ADMIN_ONLY: ReadonlySet<string> = new Set([
  ReportResolution.UserSuspended,
  ReportResolution.UserBanned,
]);

interface DecisionDialogProps {
  report: Report | null;
  onClose: () => void;
}

/**
 * The Decision dialog — resolve a report. The chosen resolution drives the
 * content/user action server-side (hide/remove/warn/suspend/ban). Suspend/ban
 * options are hidden unless the operator can suspend (admin+); the server also
 * re-checks. Requires a reason and shows the consequence tone.
 */
export function DecisionDialog({ report, onClose }: DecisionDialogProps): ReactElement | null {
  const toast = useToast();
  const { can } = usePermissions();
  const resolve = useResolveReport();
  const [resolution, setResolution] = useState<ReportResolution>(ReportResolution.NoAction);
  const [reason, setReason] = useState('');
  const [severity, setSeverity] = useState<ReportSeverity | undefined>(undefined);

  if (report === null) {
    return null;
  }

  const options = RESOLUTION_OPTIONS.filter(
    (option) => !ADMIN_ONLY.has(option.value) || can(PERMISSIONS.UserSuspend),
  );
  const isDanger = RESOLUTION_OPTIONS.find((o) => o.value === resolution)?.danger ?? false;

  const close = (): void => {
    setResolution(ReportResolution.NoAction);
    setReason('');
    setSeverity(undefined);
    onClose();
  };

  const submit = (): void => {
    resolve.mutate(
      {
        id: report.id,
        payload: {
          resolution,
          reason: reason.trim() || undefined,
          severity,
        },
      },
      {
        onSuccess: () => {
          toast.success('Report resolved.');
          close();
        },
        onError: (error) => toast.error(getErrorMessage(error)),
      },
    );
  };

  return (
    <Modal
      open
      onClose={close}
      size="md"
      danger={isDanger}
      title="Resolve report"
      footer={
        <div className="flex justify-end gap-2">
          <QButton variant="secondary" onClick={close} disabled={resolve.isPending}>
            Cancel
          </QButton>
          <QButton
            variant={isDanger ? 'danger' : 'primary'}
            onClick={submit}
            loading={resolve.isPending}
          >
            Apply decision
          </QButton>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm text-ink">
          Decision
          <Select
            value={resolution}
            options={options}
            onChange={(value: ReportResolution) => setResolution(value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-ink">
          Severity (optional)
          <Select
            allowClear
            placeholder="Assess severity"
            value={severity}
            options={SEVERITY_OPTIONS}
            onChange={(value?: string) => setSeverity(value as ReportSeverity | undefined)}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-ink">
          Reason (audited)
          <Input.TextArea
            rows={3}
            maxLength={1000}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Why this decision was made…"
          />
        </label>
        {isDanger ? (
          <p className="text-xs text-danger">
            This removes content or restricts an account and is recorded in the audit trail.
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
