import { TextDirection } from '@qalam/shared';

import { TaxonomyRepository } from '../../modules/taxonomy/taxonomy.repository';

/** Launch languages (docs 04 §9). Urdu is RTL/Nastaliq — the reason RTL is day-one. */
const SEED_LANGUAGES = [
  {
    code: 'hi',
    nameEn: 'Hindi',
    nativeName: 'हिन्दी',
    direction: TextDirection.Ltr,
    script: 'Devanagari',
    sortOrder: 1,
  },
  {
    code: 'ur',
    nameEn: 'Urdu',
    nativeName: 'اردو',
    direction: TextDirection.Rtl,
    script: 'Nastaliq',
    sortOrder: 2,
  },
  {
    code: 'en',
    nameEn: 'English',
    nativeName: 'English',
    direction: TextDirection.Ltr,
    script: 'Latin',
    sortOrder: 3,
  },
] as const;

/** Starter genres for the launch audience (docs 04 §9); admin-extendable later. */
const SEED_GENRES = [
  { slug: 'poetry', name: 'Poetry' },
  { slug: 'ghazal', name: 'Ghazal' },
  { slug: 'nazm', name: 'Nazm' },
  { slug: 'short-story', name: 'Short Story' },
  { slug: 'flash-fiction', name: 'Flash Fiction' },
  { slug: 'essay', name: 'Essay' },
  { slug: 'memoir', name: 'Memoir' },
  { slug: 'letter', name: 'Letter' },
] as const;

/** Idempotent taxonomy seed (insert-if-missing by natural key). */
export async function seedTaxonomy(repo: TaxonomyRepository): Promise<void> {
  for (const language of SEED_LANGUAGES) {
    await repo.upsertLanguage(language);
  }
  for (const [index, genre] of SEED_GENRES.entries()) {
    await repo.upsertGenre({ ...genre, sortOrder: index + 1 });
  }
}
