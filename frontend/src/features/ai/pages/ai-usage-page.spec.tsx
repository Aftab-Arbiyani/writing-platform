import type { AiUsageResponse, AiUsageWindowSummary } from '@qalam/api-types';
import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/test/render';

import { aiApi } from '../api/ai.api';
import { AiUsagePage } from './ai-usage-page';

vi.mock('../api/ai.api');

const usage = vi.mocked(aiApi.usage);

function window_(over: Partial<AiUsageWindowSummary> = {}): AiUsageWindowSummary {
  return {
    inputTokens: 1_200,
    outputTokens: 800,
    totalTokens: 2_000,
    requests: 5,
    estimatedCostUsd: 0.0123,
    tokenLimit: 10_000,
    usedFraction: 0.2,
    ...over,
  };
}

function summary(over: Partial<AiUsageResponse> = {}): AiUsageResponse {
  return {
    daily: window_(),
    monthly: window_(),
    total: window_({ tokenLimit: null, usedFraction: null }),
    byFeature: [{ feature: 'writing_assistant', totalTokens: 2_000, requests: 5 }],
    ...over,
  };
}

describe('AiUsagePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usage.mockResolvedValue(summary() as never);
  });

  it('renders all three windows', async () => {
    renderWithProviders(<AiUsagePage />);
    const list = await screen.findByRole('list', { name: 'Token usage windows' });
    expect(list.querySelectorAll('li')).toHaveLength(3);
    expect(screen.getByText('Today')).toBeInTheDocument();
    expect(screen.getByText('This month')).toBeInTheDocument();
    expect(screen.getByText('All time')).toBeInTheDocument();
  });

  it('reads the AF1 route, not the monetization rollup', async () => {
    renderWithProviders(<AiUsagePage />);
    await screen.findByRole('list', { name: 'Token usage windows' });
    // The distinction this whole page depends on: `/ai/usage/me` is the AI platform's own ledger,
    // `/monetization/usage` is the AF5 rollup W4 already ships at /settings/billing/usage.
    expect(usage).toHaveBeenCalledTimes(1);
  });

  it('shows the input/output split the billing page cannot', async () => {
    // The only figure unique to this lens — the AF5 rollup records totals, not the direction.
    renderWithProviders(<AiUsagePage />);
    expect((await screen.findAllByText('1,200 in · 800 out')).length).toBeGreaterThan(0);
  });

  it('exposes a capped window as a progressbar with its real value', async () => {
    renderWithProviders(<AiUsagePage />);
    const bars = await screen.findAllByRole('progressbar');
    // Two capped windows (daily + monthly); lifetime is uncapped and must not draw a bar.
    expect(bars).toHaveLength(2);
    expect(bars[0]).toHaveAttribute('aria-valuenow', '20');
    expect(bars[0]).toHaveAttribute('aria-valuetext', '20% used');
  });

  it('draws no progressbar for an uncapped window', async () => {
    // `tokenLimit: null` means unlimited (`usage.service.ts:129`), and there is no fraction of
    // infinity to render. A 0%-wide bar would read as "nothing used", which is a different claim.
    usage.mockResolvedValue(
      summary({
        daily: window_({ tokenLimit: null, usedFraction: null }),
        monthly: window_({ tokenLimit: null, usedFraction: null }),
      }) as never,
    );
    renderWithProviders(<AiUsagePage />);
    await screen.findByRole('list', { name: 'Token usage windows' });
    expect(screen.queryAllByRole('progressbar')).toHaveLength(0);
    expect(screen.getAllByText('No cap on this window.')).toHaveLength(3);
  });

  it('says a reached cap is reached', async () => {
    usage.mockResolvedValue(
      summary({
        daily: window_({ totalTokens: 10_000, tokenLimit: 10_000, usedFraction: 1 }),
      }) as never,
    );
    renderWithProviders(<AiUsagePage />);
    expect(await screen.findByText('Cap reached')).toBeInTheDocument();
  });

  it('renders sub-cent cost with enough precision to be non-zero', async () => {
    // A single completion often costs a fraction of a cent; `$0.00` for real spend reads as free,
    // which defeats the point of a page about metering.
    usage.mockResolvedValue(summary({ daily: window_({ estimatedCostUsd: 0.0004 }) }) as never);
    renderWithProviders(<AiUsagePage />);
    expect(await screen.findByText('$0.0004')).toBeInTheDocument();
  });

  it('renders a cost above a cent in ordinary currency form', async () => {
    usage.mockResolvedValue(summary({ daily: window_({ estimatedCostUsd: 1.5 }) }) as never);
    renderWithProviders(<AiUsagePage />);
    expect(await screen.findByText('$1.50')).toBeInTheDocument();
  });

  it('labels the per-feature breakdown as lifetime', async () => {
    // `featureBreakdown` takes no `since` (usage.service.ts:100), so these rows are lifetime totals
    // even though they sit under three windowed cards. Unlabelled, they would read as windowed.
    renderWithProviders(<AiUsagePage />);
    expect(await screen.findByText('Writing assistant')).toBeInTheDocument();
    expect(screen.getByText(/Lifetime totals/)).toBeInTheDocument();
  });

  it('explains an empty breakdown instead of rendering an empty list', async () => {
    usage.mockResolvedValue(summary({ byFeature: [] }) as never);
    renderWithProviders(<AiUsagePage />);
    expect(await screen.findByText(/No AI requests recorded yet/)).toBeInTheDocument();
  });

  it('singularises a single request', async () => {
    usage.mockResolvedValue(
      summary({
        byFeature: [{ feature: 'craft_coach', totalTokens: 400, requests: 1 }],
      }) as never,
    );
    renderWithProviders(<AiUsagePage />);
    expect(await screen.findByText(/400 tokens · 1 request$/)).toBeInTheDocument();
  });

  it('reports a failed read rather than an empty page', async () => {
    usage.mockRejectedValue(new Error('boom'));
    renderWithProviders(<AiUsagePage />);
    expect(await screen.findByRole('status')).toBeInTheDocument();
  });
});
