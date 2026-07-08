import { Injectable } from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import type { EntityManager } from 'typeorm';

import { Genre } from './entities/genre.entity';
import { Language } from './entities/language.entity';

/** Data access for the taxonomy reference tables (docs 16 §3.3). */
@Injectable()
export class TaxonomyRepository {
  constructor(private readonly dataSource: DataSource) {}

  private manager(manager?: EntityManager): EntityManager {
    return manager ?? this.dataSource.manager;
  }

  findActiveLanguageById(id: string): Promise<Language | null> {
    return this.manager()
      .getRepository(Language)
      .findOne({ where: { id, isActive: true } });
  }

  findActiveLanguageByCode(code: string): Promise<Language | null> {
    return this.manager()
      .getRepository(Language)
      .findOne({ where: { code, isActive: true } });
  }

  listActiveLanguages(): Promise<Language[]> {
    return this.manager()
      .getRepository(Language)
      .find({ where: { isActive: true }, order: { sortOrder: 'ASC', nameEn: 'ASC' } });
  }

  findActiveGenresBySlugs(slugs: string[]): Promise<Genre[]> {
    if (slugs.length === 0) {
      return Promise.resolve([]);
    }
    return this.manager()
      .getRepository(Genre)
      .find({ where: { slug: In(slugs), isActive: true } });
  }

  findGenresByIds(ids: string[]): Promise<Genre[]> {
    if (ids.length === 0) {
      return Promise.resolve([]);
    }
    return this.manager()
      .getRepository(Genre)
      .find({ where: { id: In(ids) }, order: { sortOrder: 'ASC', name: 'ASC' } });
  }

  /** Idempotent seed helpers (insert-if-missing by natural key, docs 04 §9). */
  async upsertLanguage(data: Partial<Language>, manager?: EntityManager): Promise<void> {
    const repo = this.manager(manager).getRepository(Language);
    if ((await repo.findOne({ where: { code: data.code } })) === null) {
      await repo.save(repo.create(data));
    }
  }

  async upsertGenre(data: Partial<Genre>, manager?: EntityManager): Promise<void> {
    const repo = this.manager(manager).getRepository(Genre);
    if ((await repo.findOne({ where: { slug: data.slug } })) === null) {
      await repo.save(repo.create(data));
    }
  }
}
