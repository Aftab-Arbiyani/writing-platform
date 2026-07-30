import {
  FEATURED_QUOTE_MAX,
  SUBTITLE_MAX,
  TAGS_MAX_PER_PIECE,
  TITLE_MAX,
  Visibility,
} from '@qalam/shared';
import { z } from 'zod';

/**
 * Publish-sheet schema (docs/33, docs/06 §3.4). Built from `@qalam/shared` atoms so the client
 * and the `Create/UpdatePieceDto` cannot drift. Title + genre are required to publish (the
 * server also enforces this via `PIECE_INCOMPLETE`); a future schedule must be in the future
 * (server: `PIECE_SCHEDULE_IN_PAST`). Content sufficiency (wordCount > 0) is enforced
 * server-side and surfaced as a banner.
 */
export const publishSchema = z
  .object({
    title: z.string().trim().min(1, 'Give your piece a title.').max(TITLE_MAX),
    subtitle: z.string().max(SUBTITLE_MAX, `Keep it under ${String(SUBTITLE_MAX)} characters.`),
    featuredQuote: z
      .string()
      .max(FEATURED_QUOTE_MAX, `Keep it under ${String(FEATURED_QUOTE_MAX)} characters.`),
    languageCode: z.string().min(1, 'Choose a language.'),
    genreSlug: z.string().min(1, 'Choose a genre.'),
    tags: z.array(z.string()).max(TAGS_MAX_PER_PIECE, `Up to ${String(TAGS_MAX_PER_PIECE)} tags.`),
    visibility: z.nativeEnum(Visibility),
    scheduleEnabled: z.boolean(),
    /** From a native datetime-local input (local wall-clock); converted to ISO on submit. */
    scheduledAt: z.string(),
  })
  .refine(
    (data) =>
      !data.scheduleEnabled ||
      (data.scheduledAt !== '' && new Date(data.scheduledAt).getTime() > Date.now()),
    { path: ['scheduledAt'], message: 'Pick a date and time in the future.' },
  );

export type PublishInput = z.infer<typeof publishSchema>;
