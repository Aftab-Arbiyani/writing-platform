import { Injectable } from '@nestjs/common';
import type { ShareChannel } from '@qalam/shared';
import { DataSource } from 'typeorm';
import type { EntityManager, Repository } from 'typeorm';

import { Share } from './entities/share.entity';

/** Data access for `shares` — an append-only tracking log (docs 04 §3, E7). */
@Injectable()
export class SharesRepository {
  constructor(private readonly dataSource: DataSource) {}

  private repo(manager?: EntityManager): Repository<Share> {
    return (manager ?? this.dataSource.manager).getRepository(Share);
  }

  async create(
    data: { userId: string | null; pieceId: string; channel: ShareChannel },
    manager?: EntityManager,
  ): Promise<void> {
    const repo = this.repo(manager);
    await repo.save(repo.create(data));
  }
}
