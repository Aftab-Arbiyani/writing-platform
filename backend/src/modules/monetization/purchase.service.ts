import { createHash } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CreditReason, PaymentProvider, PurchaseKind, PurchaseStatus } from '@qalam/shared';
import { Repository } from 'typeorm';

import type { CursorPayload } from '../../common/pagination/cursor.util';
import { CreditService } from './credit.service';
import { PurchaseNotFoundException } from './monetization.exceptions';
import { Purchase } from './entities/purchase.entity';
import { PaymentRegistryService } from './payments/payment-registry.service';

/** A verified purchase to record + fulfil. */
export interface RecordPurchaseInput {
  userId: string;
  kind: PurchaseKind;
  provider: PaymentProvider;
  providerRef: string | null;
  productId?: string | null;
  amount?: number;
  currency?: string;
  credits?: number;
  subscriptionId?: string | null;
  receiptHash?: string | null;
}

/**
 * The Purchase service (AF5) — one-time purchases, credit packs, and store purchase
 * RESTORATION. Every recorded purchase is de-duplicated on `(provider, providerRef)` so a
 * replayed/restored receipt never double-grants (idempotent fulfilment). Store receipts are
 * validated server-side via the provider adapter (NEVER trusting the client) before any
 * grant. Credit fulfilment reuses the Credit service; subscription restoration is delegated
 * to the Subscription service by the caller (Billing), keeping this service side-effect-lean.
 */
@Injectable()
export class PurchaseService {
  constructor(
    @InjectRepository(Purchase) private readonly purchases: Repository<Purchase>,
    private readonly registry: PaymentRegistryService,
    private readonly credits: CreditService,
  ) {}

  /**
   * Record + fulfil a verified purchase (idempotent). If a purchase with the same
   * `providerRef` already exists, returns it without re-granting.
   */
  async record(input: RecordPurchaseInput): Promise<Purchase> {
    if (input.providerRef !== null) {
      const existing = await this.purchases.findOne({
        where: { provider: input.provider, providerRef: input.providerRef },
      });
      if (existing !== null) {
        return existing; // already fulfilled — idempotent
      }
    }
    const purchase = await this.purchases.save(
      this.purchases.create({
        userId: input.userId,
        kind: input.kind,
        status: PurchaseStatus.Completed,
        provider: input.provider,
        providerRef: input.providerRef,
        productId: input.productId ?? null,
        amount: input.amount ?? 0,
        currency: input.currency ?? 'usd',
        creditsGranted: input.credits ?? 0,
        subscriptionId: input.subscriptionId ?? null,
        receiptHash: input.receiptHash ?? null,
        metadata: {},
      }),
    );
    if ((input.credits ?? 0) > 0) {
      await this.credits.grant({
        userId: input.userId,
        amount: input.credits ?? 0,
        reason: CreditReason.Purchase,
        refType: 'purchase',
        refId: purchase.id,
      });
    }
    return purchase;
  }

  /**
   * Validate a store receipt and record/fulfil the credit purchase it represents
   * (idempotent). Returns the purchase.
   */
  async fulfilStoreCreditPurchase(
    userId: string,
    provider: PaymentProvider,
    receipt: string,
    credits: number,
  ): Promise<Purchase> {
    const validation = await this.registry.get(provider).validateReceipt(receipt);
    if (!validation.valid) {
      throw new PurchaseNotFoundException();
    }
    return this.record({
      userId,
      kind: PurchaseKind.Credits,
      provider,
      providerRef: validation.providerRef,
      productId: validation.productId,
      credits,
      receiptHash: hashReceipt(receipt),
    });
  }

  /**
   * Restore purchases from a store receipt: re-validate + re-record any missing purchase
   * rows (idempotent). Returns how many purchases were (re)affirmed. Subscription
   * re-activation is handled by the caller from the validation result.
   */
  async restore(
    userId: string,
    provider: PaymentProvider,
    receipt: string,
  ): Promise<{ restored: number; providerRef: string | null; expiresAt: Date | null }> {
    const validation = await this.registry.get(provider).validateReceipt(receipt);
    if (!validation.valid || validation.providerRef === null) {
      throw new PurchaseNotFoundException();
    }
    const existing = await this.purchases.findOne({
      where: { provider, providerRef: validation.providerRef },
    });
    if (existing === null) {
      await this.record({
        userId,
        kind: validation.kind ?? PurchaseKind.OneTime,
        provider,
        providerRef: validation.providerRef,
        productId: validation.productId,
        receiptHash: hashReceipt(receipt),
      });
    }
    return { restored: 1, providerRef: validation.providerRef, expiresAt: validation.expiresAt };
  }

  async list(userId: string, cursor: CursorPayload | null, limit: number): Promise<Purchase[]> {
    const qb = this.purchases
      .createQueryBuilder('p')
      .where('p.user_id = :userId', { userId })
      .orderBy('p.created_at', 'DESC')
      .addOrderBy('p.id', 'DESC')
      .limit(limit + 1);
    if (cursor !== null) {
      qb.andWhere('(p.created_at, p.id) < (:ck::timestamptz, :cid::uuid)', {
        ck: cursor.k,
        cid: cursor.id,
      });
    }
    return qb.getMany();
  }
}

/** SHA-256 hex of a receipt — stored for audit, never the raw receipt. */
function hashReceipt(receipt: string): string {
  return createHash('sha256').update(receipt).digest('hex');
}
