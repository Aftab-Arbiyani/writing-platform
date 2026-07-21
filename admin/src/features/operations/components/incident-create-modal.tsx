import { QButton, useToast } from '@qalam/ui';
import { Input, Select } from 'antd';
import { useEffect, useState, type ReactElement } from 'react';

import { Modal } from '@/components/modal';
import { getErrorMessage } from '@/lib/errors';

import { useCreateIncident } from '../hooks/use-operations';
import type { CreateIncidentPayload, IncidentSeverity } from '../types/operations.types';

const SEVERITY_OPTIONS: Array<{ value: IncidentSeverity; label: string }> = [
  { value: 'sev1', label: 'SEV1 — critical' },
  { value: 'sev2', label: 'SEV2 — major' },
  { value: 'sev3', label: 'SEV3 — minor' },
  { value: 'sev4', label: 'SEV4 — low' },
];

export interface IncidentCreateModalProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Declare-a-new-incident modal (POST /admin/operations/incidents). Gated on `settings.manage` at the
 * call site. Title + severity are required; service is optional. On success the mutation invalidates
 * the operations namespace so the list + summary refresh.
 */
export function IncidentCreateModal({ open, onClose }: IncidentCreateModalProps): ReactElement {
  const toast = useToast();
  const create = useCreateIncident();
  const [title, setTitle] = useState('');
  const [severity, setSeverity] = useState<IncidentSeverity>('sev3');
  const [service, setService] = useState('');

  // Reset the form each time the modal opens.
  useEffect(() => {
    if (open) {
      setTitle('');
      setSeverity('sev3');
      setService('');
    }
  }, [open]);

  const submit = (): void => {
    const trimmedTitle = title.trim();
    if (trimmedTitle === '') return;
    const payload: CreateIncidentPayload = { title: trimmedTitle, severity };
    const trimmedService = service.trim();
    if (trimmedService !== '') payload.service = trimmedService;
    create.mutate(payload, {
      onSuccess: () => {
        toast.success('Incident declared.');
        onClose();
      },
      onError: (error) => toast.error(getErrorMessage(error)),
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Declare incident"
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
            disabled={title.trim() === ''}
          >
            Declare
          </QButton>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-ink">Title</span>
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={200}
            placeholder="Short, specific summary of the incident"
            aria-label="Incident title"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-ink">Severity</span>
          <Select
            value={severity}
            onChange={(value: IncidentSeverity) => setSeverity(value)}
            options={SEVERITY_OPTIONS}
            aria-label="Incident severity"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-ink">Service</span>
          <span className="text-xs text-ink-muted">
            Optional — the affected service or component.
          </span>
          <Input
            value={service}
            onChange={(event) => setService(event.target.value)}
            maxLength={120}
            placeholder="e.g. api, worker, search"
            aria-label="Affected service"
          />
        </label>
      </div>
    </Modal>
  );
}
