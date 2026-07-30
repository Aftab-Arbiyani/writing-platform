import { render, waitFor } from '@testing-library/react';
import type { ReactElement } from 'react';
import { HelmetProvider } from 'react-helmet-async';
import { describe, expect, it } from 'vitest';

import { Seo } from './seo';
import { websiteJsonLd } from '@/lib/seo';

function renderSeo(ui: ReactElement): void {
  render(<HelmetProvider>{ui}</HelmetProvider>);
}

describe('<Seo>', () => {
  it('emits description, indexable robots, OG + Twitter, and a canonical link by default', async () => {
    renderSeo(<Seo title="Discover" description="Find new voices." canonicalPath="/discover" />);

    await waitFor(() => {
      expect(document.querySelector('meta[name="description"]')).toHaveAttribute(
        'content',
        'Find new voices.',
      );
    });
    expect(document.querySelector('meta[name="robots"]')).toHaveAttribute(
      'content',
      'index, follow',
    );
    expect(document.querySelector('meta[property="og:title"]')).toHaveAttribute(
      'content',
      'Discover · Qalam',
    );
    expect(document.querySelector('meta[name="twitter:card"]')).toHaveAttribute(
      'content',
      'summary_large_image',
    );
    expect(document.querySelector('link[rel="canonical"]')).toHaveAttribute(
      'href',
      `${window.location.origin}/discover`,
    );
  });

  it('marks utility pages noindex', async () => {
    renderSeo(<Seo title="Page not found" noindex />);
    await waitFor(() => {
      expect(document.querySelector('meta[name="robots"]')).toHaveAttribute(
        'content',
        'noindex, nofollow',
      );
    });
  });

  it('renders JSON-LD structured data when provided', async () => {
    renderSeo(<Seo title="Qalam" jsonLd={websiteJsonLd()} />);
    await waitFor(() => {
      const script = document.querySelector('script[type="application/ld+json"]');
      expect(script).not.toBeNull();
      expect(script?.textContent).toContain('"@type":"WebSite"');
    });
  });
});
