import {
  BIO_MAX,
  LOCATION_MAX,
  MAX_GENRES_PER_PROFILE,
  MAX_SOCIAL_LINKS,
  PEN_NAME_MAX,
  PEN_NAME_MIN,
  SOCIAL_LINK_URL_MAX,
  WEBSITE_URL_MAX,
} from '@qalam/shared';
import { z } from 'zod';

/**
 * Edit-profile schema (docs/33 §2) — built from the SAME `@qalam/shared` atoms the backend
 * `UpdateProfileDto` validates against, so the two cannot drift. `username` is intentionally
 * absent: it is permanent and no edit path is ever offered (docs/33 §4, ADR §4). `websiteUrl`
 * accepts empty (unchanged) OR a valid http(s) URL — the frozen DTO cannot clear it (docs/32 §11).
 */
const isHttpUrl = (value: string): boolean => {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

const URL_MESSAGE = 'Enter a full URL, e.g. https://example.com';

export const profileSchema = z.object({
  penName: z
    .string()
    .trim()
    .min(PEN_NAME_MIN, 'Add a pen name.')
    .max(PEN_NAME_MAX, `Keep it under ${String(PEN_NAME_MAX)} characters.`),
  bio: z.string().max(BIO_MAX, `Keep it under ${String(BIO_MAX)} characters.`),
  location: z.string().max(LOCATION_MAX, `Keep it under ${String(LOCATION_MAX)} characters.`),
  websiteUrl: z
    .string()
    .max(WEBSITE_URL_MAX, `Keep it under ${String(WEBSITE_URL_MAX)} characters.`)
    .refine((value) => value === '' || isHttpUrl(value), URL_MESSAGE),
  isPrivate: z.boolean(),
  defaultLanguageCode: z.string(),
  genres: z
    .array(z.string())
    .max(MAX_GENRES_PER_PROFILE, `Choose up to ${String(MAX_GENRES_PER_PROFILE)} genres.`),
  socialLinks: z
    .array(
      z.object({
        platform: z.string().trim().min(1, 'Name the platform.').max(30, 'Keep it short.'),
        url: z
          .string()
          .trim()
          .max(SOCIAL_LINK_URL_MAX, 'That link is too long.')
          .refine(isHttpUrl, URL_MESSAGE),
      }),
    )
    .max(MAX_SOCIAL_LINKS, `Add up to ${String(MAX_SOCIAL_LINKS)} links.`),
});

export type ProfileFormInput = z.infer<typeof profileSchema>;
