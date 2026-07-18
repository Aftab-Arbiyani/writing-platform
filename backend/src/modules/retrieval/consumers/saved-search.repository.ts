import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { SavedSearch } from '../entities/saved-search.entity';

/** Persistence for saved searches (AF4). Owner-scoped; one aggregate. */
@Injectable()
export class SavedSearchRepository {
  constructor(@InjectRepository(SavedSearch) private readonly repo: Repository<SavedSearch>) {}

  list(userId: string): Promise<SavedSearch[]> {
    return this.repo.find({ where: { userId }, order: { createdAt: 'DESC' } });
  }

  count(userId: string): Promise<number> {
    return this.repo.count({ where: { userId } });
  }

  findByName(userId: string, name: string): Promise<SavedSearch | null> {
    return this.repo.findOne({ where: { userId, name } });
  }

  findOwned(userId: string, id: string): Promise<SavedSearch | null> {
    return this.repo.findOne({ where: { id, userId } });
  }

  save(entity: SavedSearch): Promise<SavedSearch> {
    return this.repo.save(entity);
  }

  build(data: Partial<SavedSearch>): SavedSearch {
    return this.repo.create(data);
  }

  async remove(entity: SavedSearch): Promise<void> {
    await this.repo.remove(entity);
  }
}
