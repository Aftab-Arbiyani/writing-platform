import { HttpStatus, Injectable } from '@nestjs/common';
import { ERROR_CODES } from '@qalam/shared';

import { AppException } from '../../common/exceptions/app.exception';
import type { GenreDto, LanguageDto } from './dto/taxonomy-item.dto';
import type { Genre } from './entities/genre.entity';
import type { Language } from './entities/language.entity';
import { TaxonomyRepository } from './taxonomy.repository';

class LanguageInvalidException extends AppException {
  constructor() {
    super(
      ERROR_CODES.LANGUAGE_INVALID,
      'Unknown or inactive language.',
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
}
class GenreInvalidException extends AppException {
  constructor(unknown: string[]) {
    super(
      ERROR_CODES.GENRE_INVALID,
      `Unknown or inactive genre(s): ${unknown.join(', ')}`,
      HttpStatus.UNPROCESSABLE_ENTITY,
      unknown,
    );
  }
}

/**
 * Reference-data lookups for the taxonomy tables (docs 04 §3.3). Exported surface
 * of the module — other modules (e.g. profiles) validate/hydrate languages and
 * genres through here, never by reaching into the taxonomy tables (docs 16 §3.1).
 * No management APIs in this epic (genre/language CRUD is admin, E10).
 */
@Injectable()
export class TaxonomyService {
  constructor(private readonly repository: TaxonomyRepository) {}

  listLanguages(): Promise<LanguageDto[]> {
    return this.repository.listActiveLanguages().then((rows) => rows.map(toLanguageDto));
  }

  /** Validates a language id is known + active; throws `LANGUAGE_INVALID` otherwise. */
  async assertLanguage(languageId: string): Promise<void> {
    if ((await this.repository.findActiveLanguageById(languageId)) === null) {
      throw new LanguageInvalidException();
    }
  }

  /** Resolves an active language code (e.g. 'ur') to its id; throws `LANGUAGE_INVALID`. */
  async resolveLanguageCode(code: string): Promise<string> {
    const language = await this.repository.findActiveLanguageByCode(code);
    if (language === null) {
      throw new LanguageInvalidException();
    }
    return language.id;
  }

  /** Resolves genre slugs to their ids, throwing `GENRE_INVALID` for any unknown slug. */
  async resolveGenreSlugs(slugs: string[]): Promise<string[]> {
    const unique = [...new Set(slugs.map((s) => s.toLowerCase()))];
    const found = await this.repository.findActiveGenresBySlugs(unique);
    if (found.length !== unique.length) {
      const foundSlugs = new Set(found.map((g) => g.slug.toLowerCase()));
      throw new GenreInvalidException(unique.filter((s) => !foundSlugs.has(s)));
    }
    return found.map((g) => g.id);
  }

  /** Hydrates genre ids into public DTOs (for profile responses). */
  getGenresByIds(ids: string[]): Promise<GenreDto[]> {
    return this.repository.findGenresByIds(ids).then((rows) => rows.map(toGenreDto));
  }
}

function toLanguageDto(l: Language): LanguageDto {
  return {
    id: l.id,
    code: l.code,
    nameEn: l.nameEn,
    nativeName: l.nativeName,
    direction: l.direction,
    script: l.script,
  };
}
function toGenreDto(g: Genre): GenreDto {
  return { id: g.id, slug: g.slug, name: g.name };
}
