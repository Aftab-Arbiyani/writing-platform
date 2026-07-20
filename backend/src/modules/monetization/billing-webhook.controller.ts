import { Controller, HttpCode, HttpStatus, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { ApiExcludeEndpoint } from '@nestjs/swagger';
import { PaymentProvider } from '@qalam/shared';
import type { Request } from 'express';

import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { RateLimitGuard } from '../../common/guards/rate-limit.guard';
import { Public } from '../auth/decorators/public.decorator';
import { BillingService } from './billing.service';
import { WebhookSignatureInvalidException } from './monetization.exceptions';

/**
 * Payment-provider webhook receiver (AF5). PUBLIC (no JWT — the caller is the provider,
 * not a user) but every request is authenticated by the provider's SIGNATURE over the RAW
 * body (`req.rawBody`, enabled in main.ts) and replay-protected by the unique provider
 * event id — verified inside `BillingService.ingestWebhook` before any effect. Processing
 * is async (enqueued) + idempotent, so the endpoint returns 200 fast. Rate-limited by IP.
 */
@Controller('billing/webhooks')
@UseGuards(RateLimitGuard)
export class BillingWebhookController {
  constructor(private readonly billing: BillingService) {}

  @Post(':provider')
  @Public()
  @RateLimit('billingWebhook')
  @HttpCode(HttpStatus.OK)
  @ApiExcludeEndpoint()
  async receive(
    @Param('provider') provider: string,
    @Req() req: RawBodyRequest<Request>,
  ): Promise<{ received: boolean }> {
    const known = (Object.values(PaymentProvider) as string[]).includes(provider);
    if (!known) {
      throw new WebhookSignatureInvalidException();
    }
    const rawBody = req.rawBody?.toString('utf8') ?? '';
    const headers = normalizeHeaders(req.headers);
    await this.billing.ingestWebhook(provider as PaymentProvider, rawBody, headers);
    return { received: true };
  }
}

/** Flatten express headers to a lower-cased string record for signature verification. */
function normalizeHeaders(headers: Request['headers']): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (typeof value === 'string') {
      out[key.toLowerCase()] = value;
    } else if (Array.isArray(value) && value.length > 0) {
      out[key.toLowerCase()] = value[0] ?? '';
    }
  }
  return out;
}
