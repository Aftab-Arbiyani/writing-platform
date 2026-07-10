import { describe, expect, it } from 'vitest';

import { absoluteUrl, formatTitle, profileJsonLd, siteOrigin, websiteJsonLd } from './seo';

describe('seo helpers', () => {
  it('formats the document/OG title', () => {
    expect(formatTitle('Discover')).toBe('Discover · Qalam');
    expect(formatTitle()).toBe('Qalam');
  });

  it('falls back to window.location.origin when no site URL is configured', () => {
    // No VITE_SITE_URL in the test env → runtime origin.
    expect(siteOrigin()).toBe(window.location.origin);
  });

  it('absolutises relative paths and leaves absolute URLs untouched', () => {
    expect(absoluteUrl('/@ali')).toBe(`${window.location.origin}/@ali`);
    expect(absoluteUrl('feed')).toBe(`${window.location.origin}/feed`);
    expect(absoluteUrl('https://cdn.example.com/a.jpg')).toBe('https://cdn.example.com/a.jpg');
    expect(absoluteUrl(undefined)).toBeUndefined();
  });

  it('builds a WebSite JSON-LD node', () => {
    const node = websiteJsonLd();
    expect(node['@type']).toBe('WebSite');
    expect(node.name).toBe('Qalam');
  });

  it('builds a ProfilePage JSON-LD node with the person entity', () => {
    const node = profileJsonLd({
      penName: 'Meera K',
      username: 'meera_k',
      bio: 'Poet of the monsoon.',
      avatarUrl: 'https://cdn/x.jpg',
      path: '/@meera_k',
    });
    expect(node['@type']).toBe('ProfilePage');
    const person = node.mainEntity as Record<string, unknown>;
    expect(person['@type']).toBe('Person');
    expect(person.name).toBe('Meera K');
    expect(person.alternateName).toBe('@meera_k');
    expect(person.url).toBe(`${window.location.origin}/@meera_k`);
  });
});
