import type { AuditService } from '../../audit/audit.service';
import type { AlertingService } from '../alerting/alerting.service';
import { FAILURE_CLASS, INCIDENT_SEVERITY, INCIDENT_STATUS } from '../operations.constants';
import { OperationsException } from '../operations.exceptions';
import type { Incident } from '../operations.types';
import { IncidentService, type IncidentActor } from './incident.service';
import type { IncidentStore } from './incident-store';

const actor: IncidentActor = { id: 'u1', role: 'admin' };

/** In-memory fake of the durable incident store. */
function fakeStore(): IncidentStore {
  const map = new Map<string, Incident>();
  return {
    save: jest.fn((i: Incident) => {
      map.set(i.id, i);
      return Promise.resolve();
    }),
    get: jest.fn((id: string) => Promise.resolve(map.get(id) ?? null)),
    list: jest.fn(() => Promise.resolve([...map.values()])),
    listOpen: jest.fn(() =>
      Promise.resolve([...map.values()].filter((i) => i.status !== INCIDENT_STATUS.Resolved)),
    ),
    findOpenBySourceAlert: jest.fn((alertId: string) =>
      Promise.resolve(
        [...map.values()].find(
          (i) => i.sourceAlertId === alertId && i.status !== INCIDENT_STATUS.Resolved,
        ) ?? null,
      ),
    ),
  } as unknown as IncidentStore;
}

function makeService(store = fakeStore()): {
  service: IncidentService;
  store: IncidentStore;
  audit: { record: jest.Mock };
} {
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const alerting = { registerIncidentOpener: jest.fn() } as unknown as AlertingService;
  const service = new IncidentService(store, audit as unknown as AuditService, alerting);
  return { service, store, audit };
}

describe('IncidentService', () => {
  it('registers itself as the alerting escalation target on init', () => {
    const alerting = { registerIncidentOpener: jest.fn() } as unknown as AlertingService;
    const service = new IncidentService(
      fakeStore(),
      { record: jest.fn() } as unknown as AuditService,
      alerting,
    );
    service.onModuleInit();
    expect(alerting.registerIncidentOpener).toHaveBeenCalledWith(service);
  });

  it('opens an incident with an opened timeline entry + audit', async () => {
    const { service, audit } = makeService();
    const incident = await service.open(
      { title: 'API errors', severity: INCIDENT_SEVERITY.Sev2 },
      actor,
    );
    expect(incident.status).toBe(INCIDENT_STATUS.Open);
    expect(incident.timeline[0]?.type).toBe('opened');
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'operations.incident.open', actorId: 'u1' }),
    );
  });

  it('follows the lifecycle and stamps acknowledged/resolved timers', async () => {
    const { service } = makeService();
    const opened = await service.open({ title: 't', severity: INCIDENT_SEVERITY.Sev3 }, actor);
    const ack = await service.transition(opened.id, INCIDENT_STATUS.Acknowledged, actor);
    expect(ack.acknowledgedAt).not.toBeNull();
    const investigating = await service.transition(opened.id, INCIDENT_STATUS.Investigating, actor);
    expect(investigating.status).toBe(INCIDENT_STATUS.Investigating);
  });

  it('rejects an illegal transition', async () => {
    const { service } = makeService();
    const opened = await service.open({ title: 't', severity: INCIDENT_SEVERITY.Sev3 }, actor);
    await expect(
      service.transition(opened.id, INCIDENT_STATUS.Monitoring, actor),
    ).rejects.toBeInstanceOf(OperationsException);
  });

  it('resolves with a root cause + failure class and computes TTR', async () => {
    const { service } = makeService();
    const opened = await service.open({ title: 't', severity: INCIDENT_SEVERITY.Sev2 }, actor);
    const resolved = await service.resolve(
      opened.id,
      { rootCause: 'provider timeout', failureClass: FAILURE_CLASS.Dependency },
      actor,
    );
    expect(resolved.status).toBe(INCIDENT_STATUS.Resolved);
    expect(resolved.rootCause).toBe('provider timeout');
    expect(resolved.failureClass).toBe(FAILURE_CLASS.Dependency);
    expect(resolved.resolvedAt).not.toBeNull();
    expect(resolved.timeToResolveMinutes).not.toBeNull();
  });

  it('auto-opens a SEV2 incident from an alert, de-duplicating repeats', async () => {
    const { service, store } = makeService();
    await service.openFromAlert({
      id: 'alert.api.error_rate.critical',
      label: 'API 5xx',
      category: 'availability',
    });
    await service.openFromAlert({
      id: 'alert.api.error_rate.critical',
      label: 'API 5xx',
      category: 'availability',
    });
    const open = await store.listOpen();
    expect(open.filter((i) => i.sourceAlertId === 'alert.api.error_rate.critical')).toHaveLength(1);
  });

  it('builds a postmortem template from a resolved incident', async () => {
    const { service } = makeService();
    const opened = await service.open({ title: 'Outage', severity: INCIDENT_SEVERITY.Sev1 }, actor);
    await service.resolve(
      opened.id,
      { rootCause: 'bad deploy', failureClass: FAILURE_CLASS.Deployment },
      actor,
    );
    const pm = await service.postmortem(opened.id);
    expect(pm.rootCause).toBe('bad deploy');
    expect(pm.actionItems.length).toBeGreaterThan(0);
  });

  it('throws for an unknown incident id', async () => {
    const { service } = makeService();
    await expect(service.get('nope')).resolves.toBeNull();
    await expect(
      service.transition('nope', INCIDENT_STATUS.Acknowledged, actor),
    ).rejects.toBeInstanceOf(OperationsException);
  });
});
