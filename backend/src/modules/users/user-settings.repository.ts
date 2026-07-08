import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { EntityManager, Repository } from 'typeorm';

import { UserSettings } from './entities/user-settings.entity';

/** Data access for `user_settings` (1:1 satellite; docs 16 §3.3). */
@Injectable()
export class UserSettingsRepository {
  constructor(private readonly dataSource: DataSource) {}

  private repo(manager?: EntityManager): Repository<UserSettings> {
    return (manager ?? this.dataSource.manager).getRepository(UserSettings);
  }

  findByUserId(userId: string, manager?: EntityManager): Promise<UserSettings | null> {
    return this.repo(manager).findOne({ where: { userId } });
  }

  create(data: Partial<UserSettings>, manager?: EntityManager): Promise<UserSettings> {
    const repo = this.repo(manager);
    return repo.save(repo.create(data));
  }

  async update(
    userId: string,
    patch: Partial<UserSettings>,
    manager?: EntityManager,
  ): Promise<void> {
    await this.repo(manager).update({ userId }, patch);
  }
}
