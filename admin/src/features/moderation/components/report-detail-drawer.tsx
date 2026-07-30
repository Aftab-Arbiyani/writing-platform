import { PERMISSIONS, ReportStatus } from '@qalam/shared';
import { QButton, useToast } from '@qalam/ui';
import { Descriptions, Input, Popconfirm, Select, Tabs } from 'antd';
import { ChevronsUp, Pencil, RotateCcw, Trash2, X } from 'lucide-react';
import { useState, type ReactElement, type ReactNode } from 'react';

import { Drawer } from '@/components/drawer';
import { LoadingState } from '@/components/loading-state';
import { usePermissions } from '@/hooks/use-permissions';
import { getErrorMessage } from '@/lib/errors';
import { formatDate, formatDateTime } from '@/lib/format';

import {
  useAddNote,
  useDeleteNote,
  useEscalateReport,
  useReopenReport,
  useSetPriority,
  useUpdateNote,
} from '../hooks/use-moderation-mutations';
import { useReport } from '../hooks/use-reports';
import { PRIORITY_OPTIONS, REASON_LABELS, TYPE_LABELS } from '../moderation.constants';
import type { Report, ReportDetail, ReportNote } from '../types/moderation.types';
import { PriorityBadge, ReportStatusBadge, SeverityBadge } from './moderation-badges';
import { ModerationTimeline } from './moderation-timeline';
import { ReportTimeline } from './report-timeline';

interface DrawerProps {
  reportId: string | null;
  onClose: () => void;
  onResolve: (report: Report) => void;
  onAssign: (report: Report) => void;
}

function Overview({
  detail,
  onResolve,
  onAssign,
}: {
  detail: ReportDetail;
  onResolve: (report: Report) => void;
  onAssign: (report: Report) => void;
}): ReactElement {
  const { can } = usePermissions();
  const toast = useToast();
  const escalate = useEscalateReport();
  const setPriority = useSetPriority();
  const reopen = useReopenReport();
  const canResolve = can(PERMISSIONS.ReportResolve);
  const terminal =
    detail.status === ReportStatus.Resolved || detail.status === ReportStatus.Dismissed;

  const changePriority = (priority: string): void => {
    setPriority.mutate(
      { id: detail.id, priority },
      { onError: (error) => toast.error(getErrorMessage(error)) },
    );
  };

  return (
    <div className="flex flex-col gap-5">
      {canResolve ? (
        <div className="flex flex-wrap items-center gap-2">
          {terminal ? (
            <QButton
              variant="primary"
              size="sm"
              icon={RotateCcw}
              loading={reopen.isPending}
              onClick={() =>
                reopen.mutate(
                  { id: detail.id },
                  {
                    onSuccess: () => toast.success('Report reopened.'),
                    onError: (e) => toast.error(getErrorMessage(e)),
                  },
                )
              }
            >
              Reopen
            </QButton>
          ) : (
            <>
              <QButton variant="primary" size="sm" onClick={() => onResolve(detail)}>
                Resolve…
              </QButton>
              <QButton variant="secondary" size="sm" onClick={() => onAssign(detail)}>
                Assign
              </QButton>
              <QButton
                variant="secondary"
                size="sm"
                icon={ChevronsUp}
                loading={escalate.isPending}
                onClick={() =>
                  escalate.mutate(
                    { id: detail.id },
                    { onError: (e) => toast.error(getErrorMessage(e)) },
                  )
                }
              >
                Escalate
              </QButton>
            </>
          )}
          <Select
            size="small"
            aria-label="Priority"
            value={detail.priority}
            options={PRIORITY_OPTIONS}
            onChange={changePriority}
            style={{ minWidth: 120 }}
          />
        </div>
      ) : null}

      <Descriptions
        column={1}
        size="small"
        items={[
          {
            key: 'status',
            label: 'Status',
            children: <ReportStatusBadge status={detail.status} />,
          },
          {
            key: 'priority',
            label: 'Priority',
            children: <PriorityBadge priority={detail.priority} />,
          },
          {
            key: 'severity',
            label: 'Severity',
            children: <SeverityBadge severity={detail.severity} />,
          },
          {
            key: 'type',
            label: 'Type',
            children: TYPE_LABELS[detail.entityType] ?? detail.entityType,
          },
          {
            key: 'reason',
            label: 'Reason',
            children: REASON_LABELS[detail.reason] ?? detail.reason,
          },
          { key: 'description', label: 'Details', children: detail.description ?? '—' },
          { key: 'reporter', label: 'Reporter', children: detail.reporterId },
          { key: 'reportedUser', label: 'Reported user', children: detail.reportedUserId ?? '—' },
          {
            key: 'entity',
            label: 'Reported entity',
            children: `${detail.entity.type} · ${detail.entity.exists ? (detail.entity.label ?? detail.entity.id) : 'deleted'}`,
          },
          {
            key: 'assignee',
            label: 'Assignee',
            children: detail.assignedModeratorId ?? 'Unassigned',
          },
          { key: 'created', label: 'Reported', children: formatDateTime(detail.createdAt) },
          {
            key: 'resolution',
            label: 'Resolution',
            children:
              detail.resolution === null
                ? '—'
                : `${detail.resolution}${detail.resolvedAt ? ` · ${formatDate(detail.resolvedAt)}` : ''}`,
          },
        ]}
      />

      <p className="text-xs text-ink-muted">
        Evidence / screenshots are not stored by the platform — triage from the reported entity
        above.
      </p>
    </div>
  );
}

function NoteItem({ note, editable }: { note: ReportNote; editable: boolean }): ReactElement {
  const toast = useToast();
  const updateNote = useUpdateNote();
  const deleteNote = useDeleteNote();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note.body);

  const save = (): void => {
    const next = draft.trim();
    if (next === '' || next === note.body) {
      setEditing(false);
      return;
    }
    updateNote.mutate(
      { id: note.reportId, noteId: note.id, body: next },
      {
        onSuccess: () => {
          setEditing(false);
          toast.success('Note updated.');
        },
        onError: (error) => toast.error(getErrorMessage(error)),
      },
    );
  };

  return (
    <li className="rounded-md border border-line bg-surface p-2 text-sm">
      {editing ? (
        <div className="flex flex-col gap-2">
          <Input.TextArea
            rows={2}
            maxLength={2000}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            aria-label="Edit note"
          />
          <div className="flex items-center gap-2">
            <QButton variant="secondary" size="sm" onClick={save} loading={updateNote.isPending}>
              Save
            </QButton>
            <QButton
              variant="ghost"
              size="sm"
              icon={X}
              onClick={() => {
                setDraft(note.body);
                setEditing(false);
              }}
            >
              Cancel
            </QButton>
          </div>
        </div>
      ) : (
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col gap-0.5">
            <div className="text-ink">{note.body}</div>
            <div className="text-xs text-ink-muted">{formatDateTime(note.createdAt)}</div>
          </div>
          {editable ? (
            <div className="flex shrink-0 items-center gap-1">
              <QButton
                variant="ghost"
                size="sm"
                icon={Pencil}
                aria-label="Edit note"
                onClick={() => {
                  setDraft(note.body);
                  setEditing(true);
                }}
              />
              <Popconfirm
                title="Delete this note?"
                okText="Delete"
                okButtonProps={{ danger: true }}
                onConfirm={() =>
                  deleteNote.mutate(
                    { id: note.reportId, noteId: note.id },
                    {
                      onSuccess: () => toast.success('Note deleted.'),
                      onError: (error) => toast.error(getErrorMessage(error)),
                    },
                  )
                }
              >
                <QButton
                  variant="ghost"
                  size="sm"
                  icon={Trash2}
                  aria-label="Delete note"
                  loading={deleteNote.isPending}
                />
              </Popconfirm>
            </div>
          ) : null}
        </div>
      )}
    </li>
  );
}

function NotesTab({ detail }: { detail: ReportDetail }): ReactElement {
  const { can } = usePermissions();
  const toast = useToast();
  const addNote = useAddNote();
  const [body, setBody] = useState('');
  const canManage = can(PERMISSIONS.ReportResolve);

  const submit = (): void => {
    if (body.trim() === '') {
      return;
    }
    addNote.mutate(
      { id: detail.id, body: body.trim() },
      {
        onSuccess: () => {
          setBody('');
          toast.success('Note added.');
        },
        onError: (error) => toast.error(getErrorMessage(error)),
      },
    );
  };

  return (
    <div className="flex flex-col gap-3">
      {detail.notes.length === 0 ? (
        <p className="text-sm text-ink-muted">No internal notes yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {detail.notes.map((note) => (
            <NoteItem key={note.id} note={note} editable={canManage} />
          ))}
        </ul>
      )}
      {canManage ? (
        <div className="flex flex-col gap-2">
          <Input.TextArea
            rows={2}
            maxLength={2000}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Add an internal note…"
          />
          <QButton
            variant="secondary"
            size="sm"
            onClick={submit}
            loading={addNote.isPending}
            disabled={body.trim() === ''}
          >
            Add note
          </QButton>
        </div>
      ) : null}
    </div>
  );
}

/** The report detail drawer — tabbed overview / notes / history / appeal. */
export function ReportDetailDrawer({
  reportId,
  onClose,
  onResolve,
  onAssign,
}: DrawerProps): ReactElement {
  const [tab, setTab] = useState('overview');
  const detail = useReport(reportId);

  let body: ReactNode = null;
  if (reportId !== null && detail.isLoading) {
    body = <LoadingState variant="rows" rows={8} />;
  } else if (detail.isError) {
    body = <p className="text-sm text-danger">{getErrorMessage(detail.error)}</p>;
  } else if (detail.data !== undefined) {
    const data = detail.data;
    body = (
      <Tabs
        activeKey={tab}
        onChange={setTab}
        items={[
          {
            key: 'overview',
            label: 'Overview',
            children: <Overview detail={data} onResolve={onResolve} onAssign={onAssign} />,
          },
          {
            key: 'notes',
            label: `Notes (${data.notes.length})`,
            children: <NotesTab detail={data} />,
          },
          {
            key: 'timeline',
            label: 'Timeline',
            children: <ReportTimeline reportId={data.id} enabled={tab === 'timeline'} />,
          },
          {
            key: 'history',
            label: 'History',
            children: <ModerationTimeline entries={data.history} />,
          },
          {
            key: 'appeal',
            label: 'Appeal',
            children:
              data.appeal === null ? (
                <p className="text-sm text-ink-muted">No appeal filed.</p>
              ) : (
                <div className="flex flex-col gap-2 text-sm">
                  <div>
                    <span className="text-ink-secondary">Status: </span>
                    {data.appeal.status}
                  </div>
                  <div className="text-ink">{data.appeal.reason}</div>
                  <div className="text-xs text-ink-muted">
                    {formatDateTime(data.appeal.createdAt)}
                  </div>
                </div>
              ),
          },
        ]}
      />
    );
  }

  return (
    <Drawer open={reportId !== null} onClose={onClose} width={640} title="Report detail">
      {body}
    </Drawer>
  );
}
