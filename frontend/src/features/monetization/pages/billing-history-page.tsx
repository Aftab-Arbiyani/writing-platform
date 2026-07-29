import { QButton, QCard, QEmptyState, QSpinner, QTag } from '@qalam/ui';
import { Receipt } from 'lucide-react';
import { useState, type ReactElement, type ReactNode } from 'react';

import { ApiError } from '@/lib/api-client';
import { messageFor } from '@/lib/error-messages';
import { formatDate, formatDateTime } from '@/lib/format';
import { usePageTitle } from '@/hooks/use-page-title';

import {
  useInvoices,
  usePayments,
  usePurchases,
  useSubscriptionHistory,
} from '../hooks/use-billing-history';
import { formatMoney, formatTokens } from '../lib/monetization-format';
import {
  invoiceStatusLabel,
  paymentStatusLabel,
  planLabel,
  providerLabel,
  purchaseKindLabel,
  purchaseStatusLabel,
} from '../lib/monetization-labels';
import { isMonetizationEnabled } from '../lib/monetization-enabled';

type Tab = 'invoices' | 'payments' | 'purchases' | 'events';

const TABS: readonly { key: Tab; label: string }[] = [
  { key: 'invoices', label: 'Invoices' },
  { key: 'payments', label: 'Payments' },
  { key: 'purchases', label: 'Purchases' },
  { key: 'events', label: 'Plan changes' },
];

/**
 * Billing history (`/settings/billing/history`, AF5 W4) — ported from mobile's
 * `billing_history_screen`, which shows two of these four tabs (invoices and payments).
 *
 * Purchases and plan changes are added because the endpoints exist, the data is the viewer's own, and
 * each answers a question the other two cannot: a purchase is where a credit pack or a store
 * transaction is recorded, and the event log is the only place a reader can see *when* their plan
 * changed and what it changed from.
 *
 * All four are append-only ledgers, cursor-paginated, newest first.
 */
export function BillingHistoryPage(): ReactElement {
  usePageTitle('Billing history');
  const enabled = isMonetizationEnabled();
  const [tab, setTab] = useState<Tab>('invoices');

  if (!enabled) {
    return (
      <QEmptyState
        icon={Receipt}
        title="Billing history isn’t available yet"
        description="Receipts appear once subscriptions are switched on."
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h2 className="text-ink mb-1 font-serif text-xl font-semibold">Billing history</h2>
        <p className="text-ink-secondary text-sm">Everything charged to your account.</p>
      </section>

      {/*
       * Real tab semantics — `tablist`/`tab`/`tabpanel` with `aria-controls` — so arrow-key navigation
       * and the "3 of 4" announcement come for free. Only the selected panel is mounted: these are four
       * independent paginated queries, and mounting all of them would fire four requests to show one.
       */}
      <div role="tablist" aria-label="Billing history" className="border-line flex gap-1 border-b">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            role="tab"
            id={`history-tab-${key}`}
            aria-selected={tab === key}
            aria-controls={`history-panel-${key}`}
            onClick={() => {
              setTab(key);
            }}
            className={
              tab === key
                ? 'text-ink border-accent -mb-px min-h-11 border-b-2 px-3 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-accent'
                : 'text-ink-secondary hover:text-ink -mb-px min-h-11 border-b-2 border-transparent px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent'
            }
          >
            {label}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`history-panel-${tab}`} aria-labelledby={`history-tab-${tab}`}>
        {tab === 'invoices' ? <InvoicesTab /> : null}
        {tab === 'payments' ? <PaymentsTab /> : null}
        {tab === 'purchases' ? <PurchasesTab /> : null}
        {tab === 'events' ? <EventsTab /> : null}
      </div>
    </div>
  );
}

/**
 * The shared frame for a paginated ledger — loading, error, empty, rows, "load more".
 *
 * Four tabs with identical states and different row shapes: the states belong in one place so an empty
 * purchases list and an empty invoice list cannot drift into saying different things.
 */
function LedgerSection<Row>({
  query,
  empty,
  children,
}: {
  query: {
    isLoading: boolean;
    isError: boolean;
    error: unknown;
    data?: { pages: { items: Row[] }[] };
    hasNextPage: boolean;
    isFetchingNextPage: boolean;
    fetchNextPage: () => Promise<unknown>;
  };
  empty: string;
  children: (rows: Row[]) => ReactNode;
}): ReactElement {
  if (query.isLoading) {
    return (
      <div className="flex justify-center py-8">
        <QSpinner />
      </div>
    );
  }
  if (query.isError) {
    return (
      <QCard as="section">
        <p role="status" className="text-ink-secondary text-sm">
          {messageFor(query.error instanceof ApiError ? query.error.code : undefined)}
        </p>
      </QCard>
    );
  }

  const rows = query.data?.pages.flatMap((page) => page.items) ?? [];
  if (rows.length === 0) return <p className="text-ink-muted text-sm">{empty}</p>;

  return (
    <div className="flex flex-col gap-4">
      <ul className="divide-line flex flex-col divide-y">{children(rows)}</ul>
      {query.hasNextPage ? (
        <div>
          <QButton
            loading={query.isFetchingNextPage}
            disabled={query.isFetchingNextPage}
            onClick={() => {
              void query.fetchNextPage();
            }}
          >
            Load more
          </QButton>
        </div>
      ) : null}
    </div>
  );
}

function InvoicesTab(): ReactElement {
  const query = useInvoices();
  return (
    <LedgerSection query={query} empty="No invoices yet.">
      {(rows) =>
        rows.map((invoice) => (
          <li key={invoice.id} className="flex items-start justify-between gap-3 py-3">
            <div className="flex min-w-0 flex-col gap-1">
              <span className="text-ink text-sm font-medium">{invoice.number}</span>
              <span className="text-ink-muted text-xs">{formatDate(invoice.createdAt)}</span>
              <QTag color={invoice.status === 'paid' ? 'success' : 'neutral'} size="sm">
                {invoiceStatusLabel(invoice.status)}
              </QTag>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <span className="text-ink text-sm font-medium">
                {formatMoney(invoice.total, invoice.currency)}
              </span>
              {/*
               * The provider-hosted document, when the provider gave us one. A deployment with no
               * payment provider has neither, so these are rendered only if present rather than as
               * dead links.
               */}
              {invoice.hostedUrl === null ? null : (
                <a
                  href={invoice.hostedUrl}
                  rel="noopener noreferrer"
                  className="text-accent text-xs underline"
                >
                  View invoice
                </a>
              )}
              {invoice.pdfUrl === null ? null : (
                <a
                  href={invoice.pdfUrl}
                  rel="noopener noreferrer"
                  className="text-accent text-xs underline"
                >
                  Download PDF
                </a>
              )}
            </div>
          </li>
        ))
      }
    </LedgerSection>
  );
}

function PaymentsTab(): ReactElement {
  const query = usePayments();
  return (
    <LedgerSection query={query} empty="No payments yet.">
      {(rows) =>
        rows.map((payment) => (
          <li key={payment.id} className="flex items-start justify-between gap-3 py-3">
            <div className="flex min-w-0 flex-col gap-1">
              <span className="text-ink text-sm font-medium">
                {payment.description ?? providerLabel(payment.provider)}
              </span>
              <span className="text-ink-muted text-xs">
                {formatDateTime(payment.createdAt)} · {providerLabel(payment.provider)}
              </span>
              <QTag color={payment.status === 'succeeded' ? 'success' : 'neutral'} size="sm">
                {paymentStatusLabel(payment.status)}
              </QTag>
            </div>
            <span className="text-ink shrink-0 text-sm font-medium">
              {formatMoney(payment.amount, payment.currency)}
            </span>
          </li>
        ))
      }
    </LedgerSection>
  );
}

function PurchasesTab(): ReactElement {
  const query = usePurchases();
  return (
    <LedgerSection query={query} empty="No purchases yet.">
      {(rows) =>
        rows.map((purchase) => (
          <li key={purchase.id} className="flex items-start justify-between gap-3 py-3">
            <div className="flex min-w-0 flex-col gap-1">
              <span className="text-ink text-sm font-medium">
                {purchaseKindLabel(purchase.kind)}
              </span>
              <span className="text-ink-muted text-xs">
                {formatDateTime(purchase.createdAt)} · {providerLabel(purchase.provider)}
                {purchase.creditsGranted > 0
                  ? ` · ${formatTokens(purchase.creditsGranted)} credits`
                  : null}
              </span>
              <QTag color={purchase.status === 'completed' ? 'success' : 'neutral'} size="sm">
                {purchaseStatusLabel(purchase.status)}
              </QTag>
            </div>
            <span className="text-ink shrink-0 text-sm font-medium">
              {formatMoney(purchase.amount, purchase.currency)}
            </span>
          </li>
        ))
      }
    </LedgerSection>
  );
}

/**
 * The subscription event log.
 *
 * Empty for a viewer with no subscription — and reaching that empty state takes work, because unlike
 * its three sibling endpoints this one answers 404 `SUBSCRIPTION_NOT_FOUND` rather than an empty page
 * for exactly that viewer. `useSubscriptionHistory` maps the code to an empty page so a free reader
 * sees "Nothing yet" instead of an error (docs/48 §3.6, W4-1).
 */
function EventsTab(): ReactElement {
  const query = useSubscriptionHistory();
  return (
    <LedgerSection query={query} empty="No plan changes yet.">
      {(rows) =>
        rows.map((event) => (
          <li key={event.id} className="flex items-start justify-between gap-3 py-3">
            <div className="flex min-w-0 flex-col gap-1">
              {/*
               * The event `type` is a plain string on the wire, not one of the labelled enumerations —
               * `SubscriptionEventType` exists in the vocabulary but `SubscriptionEventResponse.type`
               * is typed `string`. Underscores are stripped rather than mapped, since the set the
               * server actually emits is not narrowed by the contract.
               */}
              <span className="text-ink text-sm font-medium">
                {event.type.replaceAll('_', ' ')}
              </span>
              <span className="text-ink-muted text-xs">{formatDateTime(event.createdAt)}</span>
            </div>
            {event.fromTier === null && event.toTier === null ? null : (
              <span className="text-ink-secondary shrink-0 text-sm">
                {event.fromTier === null ? '' : planLabel(event.fromTier)}
                {event.fromTier !== null && event.toTier !== null ? ' → ' : ''}
                {event.toTier === null ? '' : planLabel(event.toTier)}
              </span>
            )}
          </li>
        ))
      }
    </LedgerSection>
  );
}
