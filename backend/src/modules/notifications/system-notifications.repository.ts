import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { SystemNotification } from './entities/system-notification.entity';

/** Persistence for admin system-broadcast source records. */
@Injectable()
export class SystemNotificationsRepository {
  constructor(
    @InjectRepository(SystemNotification)
    private readonly repo: Repository<SystemNotification>,
  ) {}

  create(row: {
    title: string;
    body: string;
    data: Record<string, unknown>;
    createdBy: string | null;
    audience: string;
  }): Promise<SystemNotification> {
    return this.repo.save(this.repo.create(row));
  }

  list(limit: number): Promise<SystemNotification[]> {
    return this.repo.find({ order: { createdAt: 'DESC' }, take: limit });
  }

  findById(id: string): Promise<SystemNotification | null> {
    return this.repo.findOne({ where: { id } });
  }

  async softDelete(entity: SystemNotification): Promise<void> {
    await this.repo.softRemove(entity);
  }
}
