import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InvoiceStatus, PaymentProvider } from '@qalam/shared';
import { Repository } from 'typeorm';

import type { CursorPayload } from '../../common/pagination/cursor.util';
import { InvoiceNotFoundException } from './monetization.exceptions';
import { Invoice } from './entities/invoice.entity';

/** Fields to open a new invoice. */
export interface CreateInvoiceInput {
  userId: string;
  subscriptionId?: string | null;
  provider?: PaymentProvider;
  providerInvoiceId?: string | null;
  currency: string;
  subtotal: number;
  tax: number;
  discount?: number;
  status?: InvoiceStatus;
  periodStart?: Date | null;
  periodEnd?: Date | null;
  lineItems: Array<{ description: string; amount: number; quantity: number }>;
  hostedUrl?: string | null;
  pdfUrl?: string | null;
}

/**
 * The Invoice service (AF5) — owns the billing document per period. Creates invoices with
 * a generated human-facing number, transitions them (open → paid / void / refunded), and
 * serves the owner-scoped billing history (cursor-paginated). Amounts are minor units; the
 * total is derived (subtotal + tax − discount) so it is always internally consistent.
 */
@Injectable()
export class InvoiceService {
  constructor(@InjectRepository(Invoice) private readonly invoices: Repository<Invoice>) {}

  async create(input: CreateInvoiceInput): Promise<Invoice> {
    const discount = input.discount ?? 0;
    return this.invoices.save(
      this.invoices.create({
        userId: input.userId,
        number: generateInvoiceNumber(),
        status: input.status ?? InvoiceStatus.Open,
        provider: input.provider ?? PaymentProvider.Stripe,
        providerInvoiceId: input.providerInvoiceId ?? null,
        subscriptionId: input.subscriptionId ?? null,
        currency: input.currency,
        subtotal: input.subtotal,
        tax: input.tax,
        discount,
        total: Math.max(0, input.subtotal + input.tax - discount),
        periodStart: input.periodStart ?? null,
        periodEnd: input.periodEnd ?? null,
        dueAt: null,
        paidAt: input.status === InvoiceStatus.Paid ? new Date() : null,
        hostedUrl: input.hostedUrl ?? null,
        pdfUrl: input.pdfUrl ?? null,
        lineItems: input.lineItems,
        metadata: {},
      }),
    );
  }

  async markPaid(id: string): Promise<Invoice> {
    const invoice = await this.invoices.findOne({ where: { id } });
    if (invoice === null) {
      throw new InvoiceNotFoundException();
    }
    invoice.status = InvoiceStatus.Paid;
    invoice.paidAt = new Date();
    return this.invoices.save(invoice);
  }

  async list(userId: string, cursor: CursorPayload | null, limit: number): Promise<Invoice[]> {
    const qb = this.invoices
      .createQueryBuilder('i')
      .where('i.user_id = :userId', { userId })
      .orderBy('i.created_at', 'DESC')
      .addOrderBy('i.id', 'DESC')
      .limit(limit + 1);
    if (cursor !== null) {
      qb.andWhere('(i.created_at, i.id) < (:ck::timestamptz, :cid::uuid)', {
        ck: cursor.k,
        cid: cursor.id,
      });
    }
    return qb.getMany();
  }

  async getOwned(userId: string, id: string): Promise<Invoice> {
    const invoice = await this.invoices.findOne({ where: { id, userId } });
    if (invoice === null) {
      throw new InvoiceNotFoundException();
    }
    return invoice;
  }
}

/** Human-facing, collision-resistant invoice number (unique index is the real guard). */
function generateInvoiceNumber(): string {
  const now = new Date();
  const ym = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  const suffix = Math.floor(now.getTime() % 1_000_000)
    .toString(36)
    .toUpperCase();
  return `QLM-${ym}-${suffix}`;
}
