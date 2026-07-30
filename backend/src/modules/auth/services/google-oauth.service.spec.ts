import type { ConfigType } from '@nestjs/config';
import type { EntityManager } from 'typeorm';

import type { authConfig } from '../../../config/auth.config';
import type { RedisService } from '../../../redis/redis.service';
import type { UsersService } from '../../users/users.service';
import { User } from '../../users/entities/user.entity';
import type { AuthIdentityRepository } from '../auth-identity.repository';
import { OAuthFailedException } from '../exceptions/auth.exceptions';
import { GoogleOAuthService } from './google-oauth.service';
import type { GoogleProfile } from './google-oauth.service';

const config = {
  google: { clientId: 'cid', clientSecret: 'secret', callbackUrl: 'http://localhost:4000/cb' },
  oauthStateTtlSeconds: 600,
} as unknown as ConfigType<typeof authConfig>;

const redis = { getClient: () => ({}) } as unknown as RedisService;
const manager = {} as EntityManager;
const verifiedProfile: GoogleProfile = {
  sub: 'g-123',
  email: 'meera@example.com',
  emailVerified: true,
};

function build(overrides: {
  users?: Partial<UsersService>;
  identities?: Partial<AuthIdentityRepository>;
}): {
  service: GoogleOAuthService;
  users: jest.Mocked<UsersService>;
  identities: jest.Mocked<AuthIdentityRepository>;
} {
  const users = {
    findByEmail: jest.fn(),
    generateUniqueUsername: jest.fn().mockResolvedValue('meera'),
    createVerifiedOAuthUser: jest.fn(),
    ...overrides.users,
  } as unknown as jest.Mocked<UsersService>;
  const identities = {
    findByProviderSubject: jest.fn(),
    create: jest.fn(),
    ...overrides.identities,
  } as unknown as jest.Mocked<AuthIdentityRepository>;
  const service = new GoogleOAuthService(config, redis, users, identities);
  return { service, users, identities };
}

const userRow = (over: Partial<User>): User => Object.assign(new User(), over);

describe('GoogleOAuthService.resolveOrCreate', () => {
  it('rejects a Google account whose email is not verified', async () => {
    const { service } = build({});
    await expect(
      service.resolveOrCreate({ ...verifiedProfile, emailVerified: false }, manager),
    ).rejects.toBeInstanceOf(OAuthFailedException);
  });

  it('logs in an already-linked identity without re-linking', async () => {
    const { service, identities, users } = build({
      identities: { findByProviderSubject: jest.fn().mockResolvedValue({ userId: 'u1' }) },
    });
    await expect(service.resolveOrCreate(verifiedProfile, manager)).resolves.toEqual({
      userId: 'u1',
      linked: false,
    });
    expect(users.createVerifiedOAuthUser).not.toHaveBeenCalled();
    expect(identities.create).not.toHaveBeenCalled();
  });

  it('auto-links to an existing VERIFIED password account', async () => {
    const { service, identities } = build({
      identities: { findByProviderSubject: jest.fn().mockResolvedValue(null) },
      users: {
        findByEmail: jest
          .fn()
          .mockResolvedValue(userRow({ id: 'u2', emailVerifiedAt: new Date() })),
      },
    });
    await expect(service.resolveOrCreate(verifiedProfile, manager)).resolves.toEqual({
      userId: 'u2',
      linked: true,
    });
    expect(identities.create).toHaveBeenCalled();
  });

  it('refuses to auto-link to an UNVERIFIED account (takeover defense)', async () => {
    const { service } = build({
      identities: { findByProviderSubject: jest.fn().mockResolvedValue(null) },
      users: {
        findByEmail: jest.fn().mockResolvedValue(userRow({ id: 'u3', emailVerifiedAt: null })),
      },
    });
    await expect(service.resolveOrCreate(verifiedProfile, manager)).rejects.toBeInstanceOf(
      OAuthFailedException,
    );
  });

  it('creates a new verified account when no user exists', async () => {
    const { service, users, identities } = build({
      identities: { findByProviderSubject: jest.fn().mockResolvedValue(null) },
      users: {
        findByEmail: jest.fn().mockResolvedValue(null),
        generateUniqueUsername: jest.fn().mockResolvedValue('meera'),
        createVerifiedOAuthUser: jest.fn().mockResolvedValue(userRow({ id: 'u4' })),
      },
    });
    await expect(service.resolveOrCreate(verifiedProfile, manager)).resolves.toEqual({
      userId: 'u4',
      linked: false,
    });
    expect(users.createVerifiedOAuthUser).toHaveBeenCalledWith(
      { email: verifiedProfile.email, username: 'meera' },
      manager,
    );
    expect(identities.create).toHaveBeenCalled();
  });
});
