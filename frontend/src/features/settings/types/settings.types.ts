import type { TextDirection } from '@qalam/shared';

/**
 * Settings-feature-local types. Shared wire types (ProfileResponse, SettingsResponse, update
 * payloads) live app-level in `@/types/profile`; this file holds the taxonomy option shapes the
 * genre/language pickers render (mirrors the search browse DTOs — docs/26 §11 gap #2: no
 * `/taxonomy` endpoints, so option lists come from `GET /search/{genres,languages}`).
 */
export interface TaxonomyGenre {
  id: string;
  slug: string;
  name: string;
}

export interface TaxonomyLanguage {
  id: string;
  code: string;
  nameEn: string;
  nativeName: string;
  direction: TextDirection;
  script: string | null;
}

/** One editable social link row in the profile form (converted to a `platform → url` map on save). */
export interface SocialLinkField {
  platform: string;
  url: string;
}
