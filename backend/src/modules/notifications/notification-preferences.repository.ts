import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { NotificationPreference } from './entities/notification-preference.entity';

/** Persistence for per-user notification toggles (get-or-create on update). */
@Injectable()
export class NotificationPreferencesRepository {
  constructor(
    @InjectRepository(NotificationPreference)
    private readonly repo: Repository<NotificationPreference>,
  ) {}

  find(userId: string): Promise<NotificationPreference | null> {
    return this.repo.findOne({ where: { userId } });
  }

  /** Applies a partial update, materializing the row with all-true defaults first. */
  async upsert(
    userId: string,
    patch: Partial<NotificationPreference>,
  ): Promise<NotificationPreference> {
    const existing = await this.repo.findOne({ where: { userId } });
    if (existing !== null) {
      Object.assign(existing, patch);
      return this.repo.save(existing);
    }
    return this.repo.save(this.repo.create({ userId, ...patch }));
  }
}
