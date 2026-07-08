import { Injectable } from '@nestjs/common';
import { AuthProvider } from '@qalam/shared';
import { DataSource } from 'typeorm';
import type { EntityManager, Repository } from 'typeorm';

import { AuthIdentity } from './entities/auth-identity.entity';

/** Data access for `auth_identities` (docs 16 §3.3). */
@Injectable()
export class AuthIdentityRepository {
  constructor(private readonly dataSource: DataSource) {}

  private repo(manager?: EntityManager): Repository<AuthIdentity> {
    return (manager ?? this.dataSource.manager).getRepository(AuthIdentity);
  }

  findByProviderSubject(
    provider: AuthProvider,
    providerUserId: string,
    manager?: EntityManager,
  ): Promise<AuthIdentity | null> {
    return this.repo(manager).findOne({ where: { provider, providerUserId } });
  }

  create(data: Partial<AuthIdentity>, manager?: EntityManager): Promise<AuthIdentity> {
    const repo = this.repo(manager);
    return repo.save(repo.create(data));
  }
}
