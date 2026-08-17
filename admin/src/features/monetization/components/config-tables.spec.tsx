import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/test/render';

import { ConfigForm } from './config-form';
import type { AdminMonetizationConfig } from '../types/monetization.types';

vi.mock('../api/monetization.api');

const { monetizationApi } = await import('../api/monetization.api');
const patchConfig = vi.mocked(monetizationApi.patchConfig);

/**
 * The three config tables, which `PATCH config` could not write until B8 (docs/48 §3, A1-2).
 *
 * **This is the test that would have caught the gap from the UI side**: A1's form rendered them
 * read-only, so no spec could have asked whether a patch carried them — there was no patch to ask
 * about. Now there is, and what it sends is the interesting part: only the keys that changed, never
 * the whole table.
 */
const CONFIG: AdminMonetizationConfig = {
  creditsPerUsd: 1000,
  trialDays: 7,
  gracePeriodDays: 3,
  lowCreditThreshold: 500,
  taxRates: { default: 0, GB: 0.2 },
  currencyRates: { usd: 1, gbp: 0.79 },
  regionCurrency: { GB: 'gbp' },
};

function dialogButton(name: string): HTMLElement {
  return within(screen.getByRole('dialog')).getByRole('button', { name });
}

beforeEach(() => {
  vi.clearAllMocks();
  patchConfig.mockResolvedValue(CONFIG);
});

describe('ConfigForm — the tax and currency tables are editable (A1-2)', () => {
  it('sends a changed table value, and only that key', async () => {
    renderWithProviders(<ConfigForm config={CONFIG} />);

    fireEvent.change(screen.getByLabelText('GB', { selector: '#config-taxRates-GB' }), {
      target: { value: '0.25' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    fireEvent.click(dialogButton('Apply'));

    await waitFor(() => {
      // `default` is untouched and does not travel: the server merges, so a whole-table patch would
      // make every audit entry look like a rewrite.
      expect(patchConfig).toHaveBeenCalledWith({ taxRates: { GB: 0.25 } });
    });
  });

  it('adds a new row and sends it alongside a numeric field', async () => {
    renderWithProviders(<ConfigForm config={CONFIG} />);

    fireEvent.change(screen.getByLabelText('Add a Tax rates key'), { target: { value: 'DE' } });
    fireEvent.click(screen.getAllByRole('button', { name: /Add/ })[0]);
    fireEvent.change(screen.getByLabelText('DE', { selector: '#config-taxRates-DE' }), {
      target: { value: '0.19' },
    });
    fireEvent.change(screen.getByLabelText('Trial days'), { target: { value: '14' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    fireEvent.click(dialogButton('Apply'));

    await waitFor(() => {
      expect(patchConfig).toHaveBeenCalledWith({ trialDays: 14, taxRates: { DE: 0.19 } });
    });
  });

  it('refuses a percentage where a fraction belongs, before the round trip', () => {
    renderWithProviders(<ConfigForm config={CONFIG} />);

    fireEvent.change(screen.getByLabelText('GB', { selector: '#config-taxRates-GB' }), {
      target: { value: '20' },
    });

    // The same rule the DTO's `IsRateTable` applies, enforced where the operator can act on it.
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent(/0\.2 for 20%, not 20/);
  });

  it('states the merge rule rather than implying a blank row deletes a key', () => {
    renderWithProviders(<ConfigForm config={CONFIG} />);

    expect(screen.getByText(/a row you blank is left as it was/i)).toBeInTheDocument();
    // And no longer says the tables cannot be edited here at all.
    expect(screen.queryByText(/cannot be edited from this screen/i)).not.toBeInTheDocument();
  });

  it('lists each table change with before → after in the confirmation', () => {
    renderWithProviders(<ConfigForm config={CONFIG} />);

    fireEvent.change(screen.getByLabelText('gbp', { selector: '#config-currencyRates-gbp' }), {
      target: { value: '0.82' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    // A rate move re-prices every future subscription in that currency, so it earns the same
    // before → after treatment the four numbers already had.
    expect(screen.getByText(/Currency rates \(vs USD\) · gbp: 0\.79 → 0\.82/)).toBeInTheDocument();
  });
});
