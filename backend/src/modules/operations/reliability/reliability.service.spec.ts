import { FAILURE_CLASS, INCIDENT_SEVERITY, INCIDENT_STATUS } from '../operations.constants';
import type { Incident } from '../operations.types';
import { ReliabilityService } from './reliability.service';

function incident(overrides: Partial<Incident>): Incident {
  return {
    id: 'i1',
    title: 't',
    severity: INCIDENT_SEVERITY.Sev2,
    status: INCIDENT_STATUS.Resolved,
    service: 'api',
    assigneeId: null,
    failureClass: FAILURE_CLASS.Dependency,
    rootCause: 'x',
    sourceAlertId: null,
    createdAt: new Date().toISOString(),
    acknowledgedAt: null,
    resolvedAt: new Date().toISOString(),
    timeToResolveMinutes: 30,
    recoveryVerified: true,
    timeline: [],
    ...overrides,
  };
}

describe('ReliabilityService.compute', () => {
  const service = new ReliabilityService({} as never);

  it('reports perfect availability with no incidents', () => {
    const report = service.compute([], 30);
    expect(report.availabilityRatio).toBe(1);
    expect(report.mttrMinutes).toBeNull();
    expect(report.mtbfHours).toBeNull();
    expect(report.recoveryVerifiedRate).toBe(1);
  });

  it('computes MTTR as the mean resolve time', () => {
    const report = service.compute(
      [
        incident({ id: 'a', timeToResolveMinutes: 20 }),
        incident({ id: 'b', timeToResolveMinutes: 40 }),
      ],
      30,
    );
    expect(report.mttrMinutes).toBe(30);
    expect(report.incidentsResolved).toBe(2);
  });

  it('reduces availability by SEV1/SEV2 downtime', () => {
    const report = service.compute(
      [incident({ id: 'a', severity: INCIDENT_SEVERITY.Sev1, timeToResolveMinutes: 60 })],
      1, // 1-day window = 1440 minutes; 60m downtime → ~0.9583
    );
    expect(report.availabilityRatio).toBeLessThan(1);
    expect(report.availabilityRatio).toBeGreaterThan(0.95);
  });

  it('tallies failures by class', () => {
    const report = service.compute(
      [
        incident({ id: 'a', failureClass: FAILURE_CLASS.Dependency }),
        incident({ id: 'b', failureClass: FAILURE_CLASS.Deployment }),
        incident({ id: 'c', failureClass: FAILURE_CLASS.Dependency }),
      ],
      30,
    );
    expect(report.failuresByClass[FAILURE_CLASS.Dependency]).toBe(2);
    expect(report.failuresByClass[FAILURE_CLASS.Deployment]).toBe(1);
  });

  it('computes recovery-verified rate', () => {
    const report = service.compute(
      [
        incident({ id: 'a', recoveryVerified: true }),
        incident({ id: 'b', recoveryVerified: false }),
      ],
      30,
    );
    expect(report.recoveryVerifiedRate).toBe(0.5);
  });

  it('computes MTBF as window hours over incident count', () => {
    const report = service.compute([incident({ id: 'a' }), incident({ id: 'b' })], 30);
    expect(report.mtbfHours).toBe(360); // (30*24)/2
  });
});
