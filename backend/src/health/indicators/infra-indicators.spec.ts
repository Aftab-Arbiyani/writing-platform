import type { HealthIndicatorResult, HealthIndicatorService } from '@nestjs/terminus';
import type { DataSource } from 'typeorm';

import type { aiConfig } from '../../config/ai.config';
import type { ConfigInspectorService } from '../../config/config-inspector.service';
import type { paymentsConfig } from '../../config/payments.config';
import { AiHealthIndicator } from './ai.health-indicator';
import { ConfigHealthIndicator } from './config.health-indicator';
import { PaymentHealthIndicator } from './payment.health-indicator';
import { SearchHealthIndicator } from './search.health-indicator';

/** Terminus HealthIndicatorService stub — records the status the indicator picked. */
function terminusStub(): HealthIndicatorService {
  return {
    check: (key: string) => ({
      up: (detail: object = {}) => ({ [key]: { status: 'up', ...detail } }),
      down: (detail: object = {}) => ({ [key]: { status: 'down', ...detail } }),
    }),
  } as unknown as HealthIndicatorService;
}

/** Read a nested field from a Terminus result (index-access safe). */
function field(result: HealthIndicatorResult, key: string, prop: string): unknown {
  const entry = result[key] as Record<string, unknown> | undefined;
  return entry?.[prop];
}

describe('ConfigHealthIndicator', () => {
  it('is up when config report is not error', () => {
    const inspector = {
      report: () => ({
        status: 'degraded',
        environment: 'qa',
        configVersion: '1',
        fingerprint: 'abc',
        issues: [],
      }),
    } as unknown as ConfigInspectorService;
    const result = new ConfigHealthIndicator(terminusStub(), inspector).isHealthy('config');
    expect(field(result, 'config', 'status')).toBe('up');
  });

  it('is down when config report is error', () => {
    const inspector = {
      report: () => ({
        status: 'error',
        environment: 'production',
        configVersion: '1',
        fingerprint: 'x',
        issues: ['boom'],
      }),
    } as unknown as ConfigInspectorService;
    const result = new ConfigHealthIndicator(terminusStub(), inspector).isHealthy('config');
    expect(field(result, 'config', 'status')).toBe('down');
  });
});

describe('AiHealthIndicator', () => {
  it('reports inert when the default provider has no key', () => {
    const cfg = {
      defaultProvider: 'openai',
      providers: { openai: { apiKey: '' } },
      stub: { enabled: false },
    } as unknown as ReturnType<typeof aiConfig>;
    const result = new AiHealthIndicator(terminusStub(), cfg).isHealthy('ai');
    expect(field(result, 'ai', 'status')).toBe('up');
    expect(field(result, 'ai', 'mode')).toBe('inert');
  });

  it('reports live when configured', () => {
    const cfg = {
      defaultProvider: 'openai',
      providers: { openai: { apiKey: 'sk-real' } },
      stub: { enabled: false },
    } as unknown as ReturnType<typeof aiConfig>;
    const result = new AiHealthIndicator(terminusStub(), cfg).isHealthy('ai');
    expect(field(result, 'ai', 'mode')).toBe('live');
  });

  /**
   * AI-2 (docs/48 §3.22b) — `mode` used to be a two-state answer, which understated a stack that
   * generates real completions through `StubAdapter`. The stub holds no credential BY DESIGN, so
   * credential-presence alone reported it identically to a stack with no AI at all.
   */
  it('reports test when the stub is the active path', () => {
    const cfg = {
      defaultProvider: 'stub',
      providers: { stub: { apiKey: '' } },
      stub: { enabled: true },
    } as unknown as ReturnType<typeof aiConfig>;
    const result = new AiHealthIndicator(terminusStub(), cfg).isHealthy('ai');
    expect(field(result, 'ai', 'mode')).toBe('test');
  });

  it('needs BOTH stub conditions — selected but disabled is still inert', () => {
    // Its adapter refuses every call unless AI_STUB_ENABLED=true, so this really is inert.
    const cfg = {
      defaultProvider: 'stub',
      providers: { stub: { apiKey: '' } },
      stub: { enabled: false },
    } as unknown as ReturnType<typeof aiConfig>;
    expect(field(new AiHealthIndicator(terminusStub(), cfg).isHealthy('ai'), 'ai', 'mode')).toBe(
      'inert',
    );
  });

  it('needs BOTH stub conditions — enabled but not selected is still inert', () => {
    const cfg = {
      defaultProvider: 'openai',
      providers: { openai: { apiKey: '' } },
      stub: { enabled: true },
    } as unknown as ReturnType<typeof aiConfig>;
    expect(field(new AiHealthIndicator(terminusStub(), cfg).isHealthy('ai'), 'ai', 'mode')).toBe(
      'inert',
    );
  });
});

describe('PaymentHealthIndicator', () => {
  it('reports inert when no provider is configured', () => {
    const cfg = {
      stripe: { secretKey: '' },
      apple: { sharedSecret: '' },
      google: { serviceAccountKey: '' },
      manual: { enabled: false },
    } as unknown as ReturnType<typeof paymentsConfig>;
    const result = new PaymentHealthIndicator(terminusStub(), cfg).isHealthy('payments');
    expect(field(result, 'payments', 'mode')).toBe('inert');
  });

  it('reports test when the manual adapter is the active path', () => {
    // A preview/E2E deployment bills through `ManualAdapter` with no processor credential. Reporting
    // that as `inert` said "cannot bill" about a stack that can.
    const cfg = {
      stripe: { secretKey: '' },
      apple: { sharedSecret: '' },
      google: { serviceAccountKey: '' },
      manual: { enabled: true },
    } as unknown as ReturnType<typeof paymentsConfig>;
    const result = new PaymentHealthIndicator(terminusStub(), cfg).isHealthy('payments');
    expect(field(result, 'payments', 'mode')).toBe('test');
  });

  it('a real processor outranks manual', () => {
    // Where a customer's money actually goes is what an operator needs to see.
    const cfg = {
      stripe: { secretKey: 'sk-real' },
      apple: { sharedSecret: '' },
      google: { serviceAccountKey: '' },
      manual: { enabled: true },
    } as unknown as ReturnType<typeof paymentsConfig>;
    const result = new PaymentHealthIndicator(terminusStub(), cfg).isHealthy('payments');
    expect(field(result, 'payments', 'mode')).toBe('live');
  });
});

describe('SearchHealthIndicator', () => {
  it('is up when the FTS query succeeds', async () => {
    const ds = { query: jest.fn().mockResolvedValue([{ ok: true }]) } as unknown as DataSource;
    const result = await new SearchHealthIndicator(terminusStub(), ds).isHealthy('search');
    expect(field(result, 'search', 'status')).toBe('up');
  });

  it('is down when the FTS query throws', async () => {
    const ds = { query: jest.fn().mockRejectedValue(new Error('no fts')) } as unknown as DataSource;
    const result = await new SearchHealthIndicator(terminusStub(), ds).isHealthy('search');
    expect(field(result, 'search', 'status')).toBe('down');
  });
});
