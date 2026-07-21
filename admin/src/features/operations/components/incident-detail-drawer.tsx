import { PERMISSIONS } from '@qalam/shared';
import { QButton, useToast } from '@qalam/ui';
import { Descriptions, Input, Select, Tabs } from 'antd';
import { useState, type ReactElement, type ReactNode } from 'react';

import { Drawer } from '@/components/drawer';
import { LoadingState } from '@/components/loading-state';
import { Modal } from '@/components/modal';
import { usePermissions } from '@/hooks/use-permissions';
import { getErrorMessage } from '@/lib/errors';
import { formatDateTime } from '@/lib/format';

import {
  useAddIncidentNote,
  useIncident,
  useIncidentPostmortem,
  useResolveIncident,
  useUpdateIncidentStatus,
} from '../hooks/use-operations';
import type {
  Incident,
  IncidentPostmortem,
  IncidentStatus,
  ResolveIncidentPayload,
} from '../types/operations.types';
import { IncidentSeverityBadge, IncidentStatusBadge } from './operations-badges';

/** Non-terminal statuses an operator can set directly; resolving goes through the resolve flow. */
const STATUS_OPTIONS: Array<{ value: IncidentStatus; label: string }> = [
  { value: 'open', label: 'Open' },
  { value: 'acknowledged', label: 'Acknowledged' },
  { value: 'investigating', label: 'Investigating' },
  { value: 'identified', label: 'Identified' },
  { value: 'monitoring', label: 'Monitoring' },
];

function dash(value: string | null): string {
  return value !== null && value !== '' ? value : '—';
}

/** Resolve-incident modal (root cause + optional failure class). */
function ResolveModal({
  incidentId,
  open,
  onClose,
}: {
  incidentId: string;
  open: boolean;
  onClose: () => void;
}): ReactElement {
  const toast = useToast();
  const resolve = useResolveIncident();
  const [rootCause, setRootCause] = useState('');
  const [failureClass, setFailureClass] = useState('');

  const submit = (): void => {
    const trimmed = rootCause.trim();
    if (trimmed === '') return;
    const payload: ResolveIncidentPayload = { rootCause: trimmed };
    const trimmedClass = failureClass.trim();
    if (trimmedClass !== '') payload.failureClass = trimmedClass;
    resolve.mutate(
      { id: incidentId, payload },
      {
        onSuccess: () => {
          toast.success('Incident resolved.');
          setRootCause('');
          setFailureClass('');
          onClose();
        },
        onError: (error) => toast.error(getErrorMessage(error)),
      },
    );
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Resolve incident"
      size="md"
      footer={
        <div className="flex justify-end gap-2">
          <QButton variant="secondary" onClick={onClose} disabled={resolve.isPending}>
            Cancel
          </QButton>
          <QButton
            variant="primary"
            onClick={submit}
            loading={resolve.isPending}
            disabled={rootCause.trim() === ''}
          >
            Resolve
          </QButton>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-ink">Root cause</span>
          <Input.TextArea
            rows={3}
            maxLength={2000}
            value={rootCause}
            onChange={(event) => setRootCause(event.target.value)}
            placeholder="What caused the incident and how it was fixed"
            aria-label="Root cause"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-ink">Failure class</span>
          <span className="text-xs text-ink-muted">Optional — categorizes the failure.</span>
          <Input
            value={failureClass}
            onChange={(event) => setFailureClass(event.target.value)}
            maxLength={120}
            placeholder="e.g. dependency, capacity, deploy"
            aria-label="Failure class"
          />
        </label>
      </div>
    </Modal>
  );
}

/** Renders a generated postmortem template defensively (only scalar + string-array fields). */
function PostmortemView({ postmortem }: { postmortem: IncidentPostmortem }): ReactElement {
  const rows = Object.entries(postmortem).flatMap(([key, value]): Array<[string, ReactNode]> => {
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return [[key, String(value)]];
    }
    if (Array.isArray(value) && value.every((entry) => typeof entry === 'string')) {
      return [
        [
          key,
          <ul key={key} className="flex list-disc flex-col gap-1 ps-4">
            {(value as string[]).map((entry, index) => (
              <li key={index}>{entry}</li>
            ))}
          </ul>,
        ],
      ];
    }
    return [];
  });

  if (rows.length === 0) {
    return <p className="text-sm text-ink-muted">No postmortem content available.</p>;
  }

  return (
    <dl className="flex flex-col gap-4">
      {rows.map(([label, value]) => (
        <div key={label} className="flex flex-col gap-1">
          <dt className="text-xs font-medium uppercase tracking-wide text-ink-secondary">
            {label}
          </dt>
          <dd className="text-sm text-ink">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Timeline({ entries }: { entries: Incident['timeline'] }): ReactElement {
  if (entries.length === 0) {
    return <p className="text-sm text-ink-muted">No timeline entries yet.</p>;
  }
  return (
    <ul className="flex flex-col gap-3">
      {entries.map((entry, index) => (
        <li
          key={`${entry.at}-${index}`}
          className="flex flex-col gap-0.5 border-s border-line ps-3"
        >
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-ink-secondary">
              {entry.type}
            </span>
            <span className="text-xs text-ink-muted">{formatDateTime(entry.at)}</span>
          </div>
          <span className="text-sm text-ink">{entry.message}</span>
          {entry.actorId !== null ? (
            <span className="text-xs text-ink-muted">By {entry.actorId}</span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function Overview({ incident }: { incident: Incident }): ReactElement {
  const { can } = usePermissions();
  const toast = useToast();
  const updateStatus = useUpdateIncidentStatus();
  const addNote = useAddIncidentNote();
  const [note, setNote] = useState('');
  const [resolveOpen, setResolveOpen] = useState(false);
  const canManage = can(PERMISSIONS.SettingsManage);
  const resolved = incident.status === 'resolved';

  const changeStatus = (status: IncidentStatus): void => {
    updateStatus.mutate(
      { id: incident.id, status },
      {
        onSuccess: () => toast.success('Status updated.'),
        onError: (error) => toast.error(getErrorMessage(error)),
      },
    );
  };

  const submitNote = (): void => {
    const trimmed = note.trim();
    if (trimmed === '') return;
    addNote.mutate(
      { id: incident.id, message: trimmed },
      {
        onSuccess: () => {
          setNote('');
          toast.success('Note added.');
        },
        onError: (error) => toast.error(getErrorMessage(error)),
      },
    );
  };

  return (
    <div className="flex flex-col gap-5">
      {canManage && !resolved ? (
        <div className="flex flex-wrap items-center gap-2">
          <Select
            size="small"
            aria-label="Incident status"
            value={incident.status}
            options={STATUS_OPTIONS}
            onChange={changeStatus}
            loading={updateStatus.isPending}
            style={{ minWidth: 160 }}
          />
          <QButton variant="primary" size="sm" onClick={() => setResolveOpen(true)}>
            Resolve…
          </QButton>
        </div>
      ) : null}

      <Descriptions
        column={1}
        size="small"
        items={[
          {
            key: 'status',
            label: 'Status',
            children: <IncidentStatusBadge status={incident.status} />,
          },
          {
            key: 'severity',
            label: 'Severity',
            children: <IncidentSeverityBadge severity={incident.severity} />,
          },
          { key: 'service', label: 'Service', children: dash(incident.service) },
          { key: 'assignee', label: 'Assignee', children: dash(incident.assigneeId) },
          { key: 'failureClass', label: 'Failure class', children: dash(incident.failureClass) },
          { key: 'rootCause', label: 'Root cause', children: dash(incident.rootCause) },
          { key: 'sourceAlert', label: 'Source alert', children: dash(incident.sourceAlertId) },
          { key: 'created', label: 'Declared', children: formatDateTime(incident.createdAt) },
          {
            key: 'acknowledged',
            label: 'Acknowledged',
            children: incident.acknowledgedAt ? formatDateTime(incident.acknowledgedAt) : '—',
          },
          {
            key: 'resolved',
            label: 'Resolved',
            children: incident.resolvedAt ? formatDateTime(incident.resolvedAt) : '—',
          },
          {
            key: 'ttr',
            label: 'Time to resolve',
            children:
              incident.timeToResolveMinutes === null ? '—' : `${incident.timeToResolveMinutes} min`,
          },
          {
            key: 'recovery',
            label: 'Recovery verified',
            children: incident.recoveryVerified ? 'Yes' : 'No',
          },
        ]}
      />

      {canManage ? (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-ink">Add a note</span>
          <Input.TextArea
            rows={2}
            maxLength={2000}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Add an incident update…"
            aria-label="Incident note"
          />
          <div>
            <QButton
              variant="secondary"
              size="sm"
              onClick={submitNote}
              loading={addNote.isPending}
              disabled={note.trim() === ''}
            >
              Add note
            </QButton>
          </div>
        </div>
      ) : null}

      <ResolveModal
        incidentId={incident.id}
        open={resolveOpen}
        onClose={() => setResolveOpen(false)}
      />
    </div>
  );
}

function PostmortemTab({
  incidentId,
  active,
}: {
  incidentId: string;
  active: boolean;
}): ReactElement {
  const query = useIncidentPostmortem(incidentId, active);
  if (query.isLoading) return <LoadingState variant="rows" rows={4} />;
  if (query.isError) return <p className="text-sm text-danger">{getErrorMessage(query.error)}</p>;
  return query.data ? <PostmortemView postmortem={query.data} /> : <span />;
}

export interface IncidentDetailDrawerProps {
  incidentId: string | null;
  onClose: () => void;
}

/** Incident detail side-sheet — tabbed overview / timeline / postmortem with the mutation actions. */
export function IncidentDetailDrawer({
  incidentId,
  onClose,
}: IncidentDetailDrawerProps): ReactElement {
  const [tab, setTab] = useState('overview');
  const query = useIncident(incidentId);

  let body: ReactNode = null;
  if (incidentId !== null && query.isLoading) {
    body = <LoadingState variant="rows" rows={8} />;
  } else if (query.isError) {
    body = <p className="text-sm text-danger">{getErrorMessage(query.error)}</p>;
  } else if (query.data !== undefined) {
    const incident = query.data;
    body = (
      <Tabs
        activeKey={tab}
        onChange={setTab}
        items={[
          { key: 'overview', label: 'Overview', children: <Overview incident={incident} /> },
          {
            key: 'timeline',
            label: `Timeline (${incident.timeline.length})`,
            children: <Timeline entries={incident.timeline} />,
          },
          {
            key: 'postmortem',
            label: 'Postmortem',
            children: <PostmortemTab incidentId={incident.id} active={tab === 'postmortem'} />,
          },
        ]}
      />
    );
  }

  return (
    <Drawer
      open={incidentId !== null}
      onClose={onClose}
      width={640}
      title={query.data?.title ?? 'Incident detail'}
    >
      {body}
    </Drawer>
  );
}
