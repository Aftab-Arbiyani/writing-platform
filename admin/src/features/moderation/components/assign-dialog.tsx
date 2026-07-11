import { QButton, useToast } from '@qalam/ui';
import { Select } from 'antd';
import { useState, type ReactElement } from 'react';

import { Modal } from '@/components/modal';
import { getErrorMessage } from '@/lib/errors';

import { useAssignReport } from '../hooks/use-moderation-mutations';
import { useModerators } from '../hooks/use-reports';
import type { Report } from '../types/moderation.types';

interface AssignDialogProps {
  report: Report | null;
  onClose: () => void;
}

/** Moderator Assignment dialog — assign a report to a moderator/admin. */
export function AssignDialog({ report, onClose }: AssignDialogProps): ReactElement | null {
  const toast = useToast();
  const moderators = useModerators();
  const assign = useAssignReport();
  const [moderatorId, setModeratorId] = useState<string | undefined>(undefined);

  if (report === null) {
    return null;
  }

  const options = (moderators.data ?? []).map((mod) => ({
    label: `${mod.displayName ?? mod.username} · ${mod.role}`,
    value: mod.id,
  }));

  const submit = (): void => {
    if (moderatorId === undefined) {
      return;
    }
    assign.mutate(
      { id: report.id, moderatorId },
      {
        onSuccess: () => {
          toast.success('Report assigned.');
          setModeratorId(undefined);
          onClose();
        },
        onError: (error) => toast.error(getErrorMessage(error)),
      },
    );
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title="Assign moderator"
      footer={
        <div className="flex justify-end gap-2">
          <QButton variant="secondary" onClick={onClose} disabled={assign.isPending}>
            Cancel
          </QButton>
          <QButton
            variant="primary"
            onClick={submit}
            loading={assign.isPending}
            disabled={moderatorId === undefined}
          >
            Assign
          </QButton>
        </div>
      }
    >
      <label className="flex flex-col gap-1 text-sm text-ink">
        Moderator
        <Select
          showSearch
          loading={moderators.isLoading}
          placeholder="Select a moderator"
          value={moderatorId}
          options={options}
          onChange={setModeratorId}
          filterOption={(input, option) =>
            String(option?.label ?? '')
              .toLowerCase()
              .includes(input.toLowerCase())
          }
        />
      </label>
    </Modal>
  );
}
