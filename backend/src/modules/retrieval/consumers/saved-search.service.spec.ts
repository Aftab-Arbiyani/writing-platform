import { SAVED_SEARCH_MAX_PER_USER } from '@qalam/shared';

import { SavedSearch } from '../entities/saved-search.entity';
import {
  SavedSearchLimitExceededException,
  SavedSearchNotFoundException,
} from '../retrieval.exceptions';
import type { SavedSearchRepository } from './saved-search.repository';
import { SavedSearchService } from './saved-search.service';

function row(over: Partial<SavedSearch> = {}): SavedSearch {
  return {
    id: 'ss1',
    name: 'My search',
    query: 'aria',
    queryType: null,
    storyId: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...over,
  } as SavedSearch;
}

function makeService(overrides: Partial<Record<keyof SavedSearchRepository, jest.Mock>>) {
  const repo = {
    list: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
    findByName: jest.fn().mockResolvedValue(null),
    findOwned: jest.fn().mockResolvedValue(null),
    build: jest.fn((d: Partial<SavedSearch>) => row(d)),
    save: jest.fn((e: SavedSearch) => Promise.resolve(e)),
    remove: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as SavedSearchRepository;
  return { service: new SavedSearchService(repo), repo };
}

describe('SavedSearchService', () => {
  it('creates a new saved search under the cap', async () => {
    const { service, repo } = makeService({});
    const dto = await service.save('u1', { name: 'My search', query: 'aria' });
    expect(dto.name).toBe('My search');
    expect(repo.save).toHaveBeenCalled();
  });

  it('updates an existing saved search with the same name (idempotent)', async () => {
    const existing = row({ query: 'old' });
    const save = jest.fn((e: SavedSearch) => Promise.resolve(e));
    const { service } = makeService({ findByName: jest.fn().mockResolvedValue(existing), save });
    const dto = await service.save('u1', { name: 'My search', query: 'new query' });
    expect(dto.query).toBe('new query');
  });

  it('rejects when the per-user cap is reached', async () => {
    const { service } = makeService({
      count: jest.fn().mockResolvedValue(SAVED_SEARCH_MAX_PER_USER),
    });
    await expect(service.save('u1', { name: 'x', query: 'y' })).rejects.toBeInstanceOf(
      SavedSearchLimitExceededException,
    );
  });

  it('throws NOT_FOUND when deleting a search that is not the caller’s', async () => {
    const { service } = makeService({ findOwned: jest.fn().mockResolvedValue(null) });
    await expect(service.remove('u1', 'missing')).rejects.toBeInstanceOf(
      SavedSearchNotFoundException,
    );
  });
});
