import { PaymentStatus } from '@qalam/shared';
import type { Repository } from 'typeorm';

import type { CreditTransaction } from './entities/credit-transaction.entity';
import type { Payment } from './entities/payment.entity';
import type { Subscription } from './entities/subscription.entity';
import type { SubscriptionEvent } from './entities/subscription-event.entity';
import { MonetizationAnalyticsService } from './monetization-analytics.service';

/**
 * A1-6 (docs/48 §3): `sumPayments` filters by status only, so `totalRevenue` on a multi-currency
 * install adds unlike units — 1000 usd + 1000 inr reads as 2000, and nothing on the wire said which
 * currencies were in the mix.
 *
 * **The fix is additive and the tests are in two halves, deliberately.** `byCurrency` is new and is
 * the figure that can be added up; the four scalars keep their exact former type and meaning, because
 * the admin dashboard already reads them and §8 of the freeze forbids retyping a shipped field.
 * The second describe below is the regression guard on that promise — it is the half that would fail
 * if someone later "improved" `totalRevenue` into a map.
 */

/** A query-builder double that returns whatever raw rows the test hands it. */
function queryBuilder(rows: unknown[], one?: unknown) {
  const qb: Record<string, unknown> = {};
  for (const method of [
    'select',
    'addSelect',
    'where',
    'andWhere',
    'groupBy',
    'setParameter',
    'setParameters',
  ]) {
    qb[method] = jest.fn().mockReturnValue(qb);
  }
  qb.getRawMany = jest.fn().mockResolvedValue(rows);
  qb.getRawOne = jest.fn().mockResolvedValue(one ?? rows[0] ?? null);
  qb.getCount = jest.fn().mockResolvedValue(0);
  return qb;
}

/**
 * `payments.createQueryBuilder` is called by BOTH the legacy scalar sums and the new grouped read,
 * so the double answers by call order: the three `sumPayments` calls first (Promise.all evaluates
 * its arguments left to right), then `revenueByCurrency`.
 */
function build(opts: {
  totals: [number, number, number];
  count: number;
  grouped: Array<{
    currency: string;
    total: number;
    recent: number;
    refunded: number;
    count: number;
  }>;
}) {
  const [total, recent, refunded] = opts.totals;
  const builders = [
    queryBuilder([], { total: String(total) }),
    queryBuilder([], { total: String(recent) }),
    queryBuilder([], { total: String(refunded) }),
    queryBuilder(
      opts.grouped.map((row) => ({
        currency: row.currency,
        total: String(row.total),
        recent: String(row.recent),
        refunded: String(row.refunded),
        count: String(row.count),
      })),
    ),
  ];
  let call = 0;
  const payments = {
    createQueryBuilder: jest.fn().mockImplementation(() => builders[call++] ?? queryBuilder([])),
    count: jest.fn().mockResolvedValue(opts.count),
  } as unknown as Repository<Payment>;

  return new MonetizationAnalyticsService(
    payments,
    {} as Repository<Subscription>,
    {} as Repository<SubscriptionEvent>,
    {} as Repository<CreditTransaction>,
  );
}

describe('MonetizationAnalyticsService.revenue — the per-currency breakdown (A1-6)', () => {
  it('reports each currency separately on a mixed install', async () => {
    // The install A1-6 describes: the scalar total (84_000) is an arithmetic sum of dollars and
    // rupees and means nothing. The breakdown is the figure an operator can act on.
    const service = build({
      totals: [84_000, 12_000, 1_500],
      count: 9,
      grouped: [
        { currency: 'usd', total: 4_000, recent: 1_000, refunded: 500, count: 4 },
        { currency: 'inr', total: 80_000, recent: 11_000, refunded: 1_000, count: 5 },
      ],
    });

    const revenue = await service.revenue();

    expect(revenue.byCurrency).toEqual([
      {
        currency: 'inr',
        totalRevenue: 80_000,
        last30dRevenue: 11_000,
        refunded: 1_000,
        paymentsCount: 5,
      },
      {
        currency: 'usd',
        totalRevenue: 4_000,
        last30dRevenue: 1_000,
        refunded: 500,
        paymentsCount: 4,
      },
    ]);
    // Highest total first, so the currency that dominates the meaningless scalar leads the list.
    expect(revenue.byCurrency[0]?.currency).toBe('inr');
    // And the per-currency counts still reconcile with the scalar count, which was always sound.
    expect(revenue.byCurrency.reduce((sum, row) => sum + row.paymentsCount, 0)).toBe(
      revenue.paymentsCount,
    );
  });

  it('reports one row equal to the scalars on a single-currency install', async () => {
    const service = build({
      totals: [4_000, 1_000, 500],
      count: 4,
      grouped: [{ currency: 'usd', total: 4_000, recent: 1_000, refunded: 500, count: 4 }],
    });

    const revenue = await service.revenue();

    expect(revenue.byCurrency).toEqual([
      {
        currency: 'usd',
        totalRevenue: 4_000,
        last30dRevenue: 1_000,
        refunded: 500,
        paymentsCount: 4,
      },
    ]);
    expect(revenue.byCurrency[0]).toMatchObject({
      totalRevenue: revenue.totalRevenue,
      last30dRevenue: revenue.last30dRevenue,
      refunded: revenue.refunded,
      paymentsCount: revenue.paymentsCount,
    });
  });

  it('is empty — not absent — when no payment row exists', async () => {
    const service = build({ totals: [0, 0, 0], count: 0, grouped: [] });

    await expect(service.revenue()).resolves.toMatchObject({ byCurrency: [] });
  });

  it('reports a refund-only currency as positive refunded, never negative', async () => {
    // Refund rows are stored negative; ABS is applied per row inside the SUM, so a currency whose
    // only activity is a refund reports what was refunded rather than minus what was refunded.
    const service = build({
      totals: [0, 0, -900],
      count: 0,
      grouped: [{ currency: 'gbp', total: 0, recent: 0, refunded: 900, count: 0 }],
    });

    const revenue = await service.revenue();

    expect(revenue.byCurrency[0]).toMatchObject({
      currency: 'gbp',
      refunded: 900,
      totalRevenue: 0,
    });
  });
});

describe('MonetizationAnalyticsService.revenue — the legacy scalars are unchanged (§8)', () => {
  it('returns exactly what it returned before, with the same types and meanings', async () => {
    const service = build({
      totals: [84_000, 12_000, -1_500],
      count: 9,
      grouped: [{ currency: 'usd', total: 84_000, recent: 12_000, refunded: 1_500, count: 9 }],
    });

    const revenue = await service.revenue();

    expect(typeof revenue.totalRevenue).toBe('number');
    expect(revenue.totalRevenue).toBe(84_000);
    expect(revenue.last30dRevenue).toBe(12_000);
    // Still sign-flipped by the service, as it always was — the dashboard prints it positive.
    expect(revenue.refunded).toBe(1_500);
    expect(revenue.paymentsCount).toBe(9);
  });

  it('still sums ACROSS currencies in the scalars — the breakdown did not silently change them', async () => {
    // Stated as an assertion rather than left implicit: the scalars remain the pre-B8 arithmetic,
    // caveat and all. Anyone tempted to make them currency-aware breaks a shipped consumer, and
    // this is where they find that out.
    const service = build({
      totals: [84_000, 12_000, 1_500],
      count: 9,
      grouped: [
        { currency: 'usd', total: 4_000, recent: 1_000, refunded: 500, count: 4 },
        { currency: 'inr', total: 80_000, recent: 11_000, refunded: 1_000, count: 5 },
      ],
    });

    const revenue = await service.revenue();

    expect(revenue.totalRevenue).toBe(84_000);
    expect(revenue.totalRevenue).toBe(
      revenue.byCurrency.reduce((sum, row) => sum + row.totalRevenue, 0),
    );
  });
});

describe('MonetizationAnalyticsService.revenue — the grouped query', () => {
  it('reads only succeeded and refunded rows, grouped by currency', async () => {
    const service = build({
      totals: [0, 0, 0],
      count: 0,
      grouped: [{ currency: 'usd', total: 1, recent: 1, refunded: 0, count: 1 }],
    });

    await service.revenue();

    // The fourth builder is `revenueByCurrency`'s — one scan, not one per currency, because the
    // currency set is not known ahead of time.
    const grouped = (service as unknown as { payments: Repository<Payment> }).payments;
    const builder = (grouped.createQueryBuilder as jest.Mock).mock.results[3]?.value as Record<
      string,
      jest.Mock
    >;
    expect(builder.groupBy).toHaveBeenCalledWith('p.currency');
    expect(builder.where).toHaveBeenCalledWith('p.status IN (:...statuses)', {
      statuses: [PaymentStatus.Succeeded, PaymentStatus.Refunded],
    });
  });
});
