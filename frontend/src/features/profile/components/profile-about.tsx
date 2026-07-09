import { QTag } from '@qalam/ui';
import { Globe, Link2 } from 'lucide-react';
import type { ReactElement } from 'react';

import type { ProfileResponse } from '@/types/profile';

/** Human labels for the known social platforms; unknown keys fall back to the raw key. */
const PLATFORM_LABELS: Record<string, string> = {
  twitter: 'Twitter / X',
  x: 'X',
  instagram: 'Instagram',
  facebook: 'Facebook',
  youtube: 'YouTube',
  linkedin: 'LinkedIn',
  github: 'GitHub',
  website: 'Website',
  substack: 'Substack',
  medium: 'Medium',
};

function labelFor(key: string): string {
  return PLATFORM_LABELS[key.toLowerCase()] ?? key;
}

/**
 * "About" tab — the bio in full, plus website, social links, and genres (docs/06 §3.5). External
 * links open in a new tab with `rel="noopener noreferrer"`. Genres render as non-interactive tags
 * (genre pages are a later epic). Renders an empty note when the writer has shared nothing.
 */
export function ProfileAbout({ profile }: { profile: ProfileResponse }): ReactElement {
  const social = Object.entries(profile.socialLinks ?? {});
  const genres = profile.genres ?? [];
  const isEmpty = !profile.bio && !profile.websiteUrl && social.length === 0 && genres.length === 0;

  if (isEmpty) {
    return (
      <p className="py-8 text-center text-sm text-ink-muted">
        This writer hasn’t shared an about section yet.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6 py-2">
      {profile.bio ? (
        <section>
          <h2 className="mb-1 text-sm font-semibold text-ink-secondary">Bio</h2>
          <p dir="auto" className="max-w-prose whitespace-pre-line text-ink">
            {profile.bio}
          </p>
        </section>
      ) : null}

      {profile.websiteUrl || social.length > 0 ? (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-ink-secondary">Links</h2>
          <ul className="flex flex-wrap gap-2">
            {profile.websiteUrl ? (
              <li>
                <a
                  href={profile.websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-sm text-ink outline-none hover:bg-raised focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <Globe size={16} strokeWidth={1.5} aria-hidden />
                  Website
                </a>
              </li>
            ) : null}
            {social.map(([platform, url]) => (
              <li key={platform}>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-sm text-ink outline-none hover:bg-raised focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <Link2 size={16} strokeWidth={1.5} aria-hidden />
                  {labelFor(platform)}
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {genres.length > 0 ? (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-ink-secondary">Writes in</h2>
          <ul className="flex flex-wrap gap-2">
            {genres.map((genre) => (
              <li key={genre.id}>
                <QTag>{genre.name}</QTag>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
