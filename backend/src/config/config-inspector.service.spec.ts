import { ConfigInspectorService } from './config-inspector.service';
import type { deploymentConfig } from './deployment.config';

type DeploymentConfig = ReturnType<typeof deploymentConfig>;

function makeInspector(environment: string): ConfigInspectorService {
  const deployment = {
    environment,
    configVersion: '1.0.0',
  } as unknown as DeploymentConfig;
  return new ConfigInspectorService(deployment);
}

const REAL_SECRETS: NodeJS.ProcessEnv = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgres://u:p@db:5432/qalam',
  JWT_ACCESS_SECRET: 'a'.repeat(40),
  JWT_REFRESH_SECRET: 'b'.repeat(40),
  REDIS_URL: 'redis://cache:6379',
  S3_ACCESS_KEY: 'AKIAREAL',
  S3_SECRET_KEY: 'real-secret-1234567890',
  SMTP_URL: 'smtp://mail:25',
  METRICS_TOKEN: 'tok-123',
};

describe('ConfigInspectorService', () => {
  it('reports presence/validity but never a secret value', () => {
    const inspector = makeInspector('production');
    const report = inspector.report(REAL_SECRETS);
    const serialized = JSON.stringify(report);
    // No actual secret material may appear anywhere in the report.
    expect(serialized).not.toContain('a'.repeat(40));
    expect(serialized).not.toContain('real-secret-1234567890');
    const jwt = report.secrets.find((s) => s.name === 'JWT_ACCESS_SECRET');
    expect(jwt?.present).toBe(true);
    expect(jwt?.valid).toBe(true);
  });

  it('flags a placeholder secret as an issue on a protected tier', () => {
    const inspector = makeInspector('production');
    const report = inspector.report({ ...REAL_SECRETS, S3_ACCESS_KEY: 'minioadmin' });
    expect(report.status).toBe('error');
    expect(report.issues.join('\n')).toMatch(/S3_ACCESS_KEY/);
  });

  it('is `degraded` (not error) when only optional secrets are unset', () => {
    const inspector = makeInspector('production');
    const report = inspector.report(REAL_SECRETS); // no OPENAI/STRIPE keys
    expect(report.status).toBe('degraded');
    expect(report.protectedEnvironment).toBe(true);
  });

  it('produces a stable fingerprint that changes with config', () => {
    const inspector = makeInspector('production');
    const a = inspector.fingerprint({ NODE_ENV: 'production', APP_URL: 'https://a' });
    const b = inspector.fingerprint({ NODE_ENV: 'production', APP_URL: 'https://a' });
    const c = inspector.fingerprint({ NODE_ENV: 'production', APP_URL: 'https://b' });
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
});
