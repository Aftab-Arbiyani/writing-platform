import { Injectable } from '@nestjs/common';
import { slugify } from '@qalam/utils';
import { DataSource, In } from 'typeorm';
import type { EntityManager } from 'typeorm';

import { Genre } from './entities/genre.entity';
import { Language } from './entities/language.entity';
import { Tag } from './entities/tag.entity';

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

  /** By id regardless of active flag — a piece keeps a deactivated language. */
  findLanguageById(id: string): Promise<Language | null> {
    return this.manager().getRepository(Language).findOne({ where: { id } });
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

  /** Get-or-create tags by normalized (slugified) name — for `#hashtags` on publish. */
  async getOrCreateTags(names: string[], manager?: EntityManager): Promise<Tag[]> {
    const repo = this.manager(manager).getRepository(Tag);
    const result: Tag[] = [];
    for (const raw of names) {
      const name = raw.trim();
      const slug = slugify(name);
      let tag = await repo.findOne({ where: { slug } });
      tag ??= await repo.save(repo.create({ slug, name }));
      result.push(tag);
    }
    return result;
  }

  findTagsByIds(ids: string[], manager?: EntityManager): Promise<Tag[]> {
    if (ids.length === 0) {
      return Promise.resolve([]);
    }
    return this.manager(manager)
      .getRepository(Tag)
      .find({ where: { id: In(ids) } });
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
