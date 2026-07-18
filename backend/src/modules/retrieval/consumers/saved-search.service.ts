import { Injectable } from '@nestjs/common';
import { SAVED_SEARCH_MAX_PER_USER } from '@qalam/shared';

import type { SaveSearchDto } from '../dto/retrieval-request.dto';
import type { SavedSearchDto } from '../dto/retrieval-response.dto';
import { SavedSearch } from '../entities/saved-search.entity';
import {
  SavedSearchLimitExceededException,
  SavedSearchNotFoundException,
} from '../retrieval.exceptions';
import { SavedSearchRepository } from './saved-search.repository';

/**
 * Saved searches (AF4). Owner-scoped CRUD with a per-user cap. Re-saving an existing name
 * updates it (idempotent). Recent searches are NOT here — they reuse the E8 SearchService
 * history (`recent_searches`); this is only the explicit "saved searches" surface.
 */
@Injectable()
export class SavedSearchService {
  constructor(private readonly repo: SavedSearchRepository) {}

  async list(userId: string): Promise<SavedSearchDto[]> {
    const rows = await this.repo.list(userId);
    return rows.map(toDto);
  }

  async save(userId: string, dto: SaveSearchDto): Promise<SavedSearchDto> {
    const existing = await this.repo.findByName(userId, dto.name);
    if (existing !== null) {
      existing.query = dto.query;
      existing.queryType = dto.queryType ?? null;
      existing.storyId = dto.storyId ?? null;
      return toDto(await this.repo.save(existing));
    }

    if ((await this.repo.count(userId)) >= SAVED_SEARCH_MAX_PER_USER) {
      throw new SavedSearchLimitExceededException();
    }

    const created = this.repo.build({
      userId,
      name: dto.name,
      query: dto.query,
      queryType: dto.queryType ?? null,
      storyId: dto.storyId ?? null,
    });
    return toDto(await this.repo.save(created));
  }

  async remove(userId: string, id: string): Promise<void> {
    const existing = await this.repo.findOwned(userId, id);
    if (existing === null) throw new SavedSearchNotFoundException();
    await this.repo.remove(existing);
  }
}

function toDto(row: SavedSearch): SavedSearchDto {
  return {
    id: row.id,
    name: row.name,
    query: row.query,
    queryType: row.queryType,
    storyId: row.storyId,
    createdAt: row.createdAt.toISOString(),
  };
}
