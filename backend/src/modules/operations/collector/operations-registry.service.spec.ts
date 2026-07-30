import type { ConfigType } from '@nestjs/config';

import type { operationsConfig } from '../../../config/operations.config';
import { OperationsRegistryService } from './operations-registry.service';

type OpsConfig = ConfigType<typeof operationsConfig>;

function make(enabled = true): OperationsRegistryService {
  return new OperationsRegistryService({ enabled } as OpsConfig);
}

describe('OperationsRegistryService', () => {
  it('counts signals and separates ok/failures', () => {
    const registry = make();
    registry.record({ kind: 'deployment', name: 'deploy.recorded', ok: true });
    registry.record({ kind: 'deployment', name: 'deploy.recorded', ok: true });
    registry.record({ kind: 'failure', name: 'incident.opened', ok: false });

    expect(registry.count('deploy.recorded')).toBe(2);
    expect(registry.failures('incident.opened')).toBe(1);
    expect(registry.count('never.seen')).toBe(0);
  });

  it('sums numeric values', () => {
    const registry = make();
    registry.record({ kind: 'failure', name: 'incident.resolved', ok: true, value: 30 });
    registry.record({ kind: 'failure', name: 'incident.resolved', ok: true, value: 10 });
    expect(registry.sum('incident.resolved')).toBe(40);
  });

  it('ignores signals when disabled (zero overhead)', () => {
    const registry = make(false);
    registry.record({ kind: 'deployment', name: 'deploy.recorded', ok: true });
    expect(registry.count('deploy.recorded')).toBe(0);
  });

  it('renders the deployments_total metric line', () => {
    const registry = make();
    registry.record({ kind: 'deployment', name: 'deploy.recorded', ok: true });
    const lines = registry.metricLines();
    expect(lines.some((l) => l.startsWith('ops_deployments_total 1'))).toBe(true);
  });

  it('returns a per-minute rate for a seen signal and null for an unseen one', () => {
    const registry = make();
    registry.record({ kind: 'alert', name: 'security.event', ok: false });
    expect(registry.ratePerMinute('security.event')).not.toBeNull();
    expect(registry.ratePerMinute('security.other')).toBeNull();
  });

  it('resets all counters', () => {
    const registry = make();
    registry.record({ kind: 'deployment', name: 'deploy.recorded', ok: true });
    registry.reset();
    expect(registry.count('deploy.recorded')).toBe(0);
  });
});
