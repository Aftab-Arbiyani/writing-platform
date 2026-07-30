import { QButton, useToast } from '@qalam/ui';
import { InputNumber, Select } from 'antd';
import { useEffect, useState, type ReactElement } from 'react';

import { Modal } from '@/components/modal';
import { getErrorMessage } from '@/lib/errors';

import { useCreateMaintenanceWindow } from '../hooks/use-operations';
import type { CreateMaintenanceWindowPayload } from '../types/operations.types';

export interface MaintenanceWindowCreateModalProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Schedule-a-maintenance-window modal (POST /admin/operations/maintenance-windows). Gated on
 * `settings.manage` at the call site. Reason + duration are required; categories are free-form tags
 * that scope which alerts the window suppresses. On success the operations namespace is invalidated.
 */
export function MaintenanceWindowCreateModal({
  open,
  onClose,
}: MaintenanceWindowCreateModalProps): ReactElement {
  const toast = useToast();
  const create = useCreateMaintenanceWindow();
  const [reason, setReason] = useState('');
  const [durationMinutes, setDurationMinutes] = useState<number>(60);
  const [categories, setCategories] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      setReason('');
      setDurationMinutes(60);
      setCategories([]);
    }
  }, [open]);

  const submit = (): void => {
    const trimmed = reason.trim();
    if (trimmed === '' || durationMinutes <= 0) return;
    const payload: CreateMaintenanceWindowPayload = { reason: trimmed, durationMinutes };
    if (categories.length > 0) payload.categories = categories;
    create.mutate(payload, {
      onSuccess: () => {
        toast.success('Maintenance window scheduled.');
        onClose();
      },
      onError: (error) => toast.error(getErrorMessage(error)),
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Schedule maintenance window"
      size="md"
      footer={
        <div className="flex justify-end gap-2">
          <QButton variant="secondary" onClick={onClose} disabled={create.isPending}>
            Cancel
          </QButton>
          <QButton
            variant="primary"
            onClick={submit}
            loading={create.isPending}
            disabled={reason.trim() === '' || durationMinutes <= 0}
          >
            Schedule
          </QButton>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-ink">Reason</span>
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={500}
            rows={2}
            placeholder="Why the platform is entering maintenance"
            aria-label="Maintenance reason"
            className="w-full rounded-md border border-line bg-surface px-3 py-1.5 text-sm text-ink"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-ink">Duration (minutes)</span>
          <InputNumber
            value={durationMinutes}
            onChange={(value) => setDurationMinutes(typeof value === 'number' ? value : 0)}
            min={1}
            max={10_080}
            className="w-full max-w-[12rem]"
            aria-label="Duration in minutes"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-ink">Categories</span>
          <span className="text-xs text-ink-muted">
            Optional — alert categories this window suppresses. Type to add.
          </span>
          <Select
            mode="tags"
            value={categories}
            onChange={setCategories}
            tokenSeparators={[',']}
            placeholder="e.g. availability, latency"
            aria-label="Alert categories"
          />
        </label>
      </div>
    </Modal>
  );
}
