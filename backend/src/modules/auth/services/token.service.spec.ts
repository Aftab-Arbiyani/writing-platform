import { JwtService } from '@nestjs/jwt';
import type { ConfigType } from '@nestjs/config';
import { Role } from '@qalam/shared';
import type { Redis } from 'ioredis';

import type { authConfig } from '../../../config/auth.config';
import type { RedisService } from '../../../redis/redis.service';
import type { RolesService } from '../../users/roles.service';
import { RefreshReusedException, SessionRevokedException } from '../exceptions/auth.exceptions';
import type { AuthEventLogger } from './auth-event.logger';
import { TokenService } from './token.service';

/** Minimal in-memory Redis covering the string + set commands TokenService uses. */
function fakeRedis(): Redis {
  const strings = new Map<string, string>();
  const sets = new Map<string, Set<string>>();
  return {
    get: (k: string) => Promise.resolve(strings.get(k) ?? null),
    set: (k: string, v: string) => {
      strings.set(k, v);
      return Promise.resolve('OK');
    },
    del: (...keys: string[]) => {
      keys.forEach((k) => strings.delete(k));
      return Promise.resolve(keys.length);
    },
    incr: (k: string) => {
      const next = Number.parseInt(strings.get(k) ?? '0', 10) + 1;
      strings.set(k, String(next));
      return Promise.resolve(next);
    },
    sadd: (k: string, m: string) => {
      const set = sets.get(k) ?? new Set<string>();
      set.add(m);
      sets.set(k, set);
      return Promise.resolve(1);
    },
    srem: (k: string, m: string) => {
      sets.get(k)?.delete(m);
      return Promise.resolve(1);
    },
    smembers: (k: string) => Promise.resolve([...(sets.get(k) ?? [])]),
    expire: () => Promise.resolve(1),
  } as unknown as Redis;
}

const config = {
  jwt: {
    accessSecret: 'access-secret-that-is-at-least-32-characters',
    accessTtl: '15m',
    refreshSecret: 'refresh-secret-that-is-at-least-32-characters',
    refreshTtl: '30d',
    issuer: 'qalam',
  },
} as unknown as ConfigType<typeof authConfig>;

const ctx = { ip: '127.0.0.1', device: 'jest' };

describe('TokenService', () => {
  let service: TokenService;
  let jwt: JwtService;
  let events: { refreshReuseDetected: jest.Mock };

  beforeEach(() => {
    jwt = new JwtService({});
    events = { refreshReuseDetected: jest.fn() };
    const roles = {
      getEffectiveRole: jest.fn().mockResolvedValue(Role.User),
    } as unknown as RolesService;
    const redis = { getClient: () => fakeRedis() } as unknown as RedisService;
    service = new TokenService(config, jwt, roles, redis, events as unknown as AuthEventLogger);
  });

  it('issues an access token carrying sub, role and session version', async () => {
    const pair = await service.issuePair('user-1', ctx);
    const claims = await jwt.verifyAsync<{ sub: string; role: string; sv: number }>(
      pair.accessToken,
      {
        secret: config.jwt.accessSecret,
      },
    );

    expect(claims.sub).toBe('user-1');
    expect(claims.role).toBe(Role.User);
    expect(claims.sv).toBe(0);
  });

  it('rotates a live refresh token into a new pair', async () => {
    const first = await service.issuePair('user-1', ctx);
    const second = await service.rotate(first.refreshToken, ctx);

    expect(second.accessToken).not.toBe(first.accessToken);
    expect(second.refreshToken).not.toBe(first.refreshToken);
  });

  it('detects reuse of a consumed refresh token and revokes the family', async () => {
    const first = await service.issuePair('user-1', ctx);
    await service.rotate(first.refreshToken, ctx); // consumes first

    // Replaying the already-used token is theft → family revoked + alert.
    await expect(service.rotate(first.refreshToken, ctx)).rejects.toBeInstanceOf(
      RefreshReusedException,
    );
    expect(events.refreshReuseDetected).toHaveBeenCalledWith('user-1', expect.any(String), ctx.ip);
  });

  it('rejects rotation after "log out everywhere" deletes the family', async () => {
    const pair = await service.issuePair('user-1', ctx);
    await service.revokeAllForUser('user-1');

    await expect(service.rotate(pair.refreshToken, ctx)).rejects.toBeInstanceOf(
      SessionRevokedException,
    );
  });
});
