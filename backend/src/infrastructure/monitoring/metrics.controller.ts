import { Controller, Get, Req, Res, VERSION_NEUTRAL } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Request, Response } from 'express';

import { Public } from '../../modules/auth/decorators/public.decorator';
import { MetricsService } from './metrics.service';

/**
 * Prometheus scrape target (docs 14 §4). Mounted at the root (`/metrics`,
 * version-neutral, excluded from the `/api` prefix and from rate limiting) and
 * `@Public` so a scraper needs no JWT. Access control is layered:
 * - **App**: an optional `METRICS_TOKEN` (bearer or `?token=`) — enforced here
 *   when set (production), open in dev when unset.
 * - **Network** (production): nginx/security-group IP-allowlist in front (docs 14
 *   §4 / 15 §7) — the primary control; the token is defense in depth.
 *
 * Hidden from Swagger (`@ApiExcludeController`) — it is an ops surface, not part
 * of the product API contract.
 */
@ApiExcludeController()
@Public()
@Controller({ path: 'metrics', version: VERSION_NEUTRAL })
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Get()
  async scrape(@Req() req: Request, @Res() res: Response): Promise<void> {
    if (!this.authorized(req)) {
      res.status(401).type('text/plain').send('unauthorized');
      return;
    }
    res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    res.send(await this.metrics.render());
  }

  /** True when no token is configured (dev) or the presented token matches. */
  private authorized(req: Request): boolean {
    const expected = process.env.METRICS_TOKEN ?? '';
    if (expected === '') {
      return true;
    }
    const header = req.header('authorization');
    const bearer = header?.startsWith('Bearer ') === true ? header.slice(7) : undefined;
    const query = typeof req.query.token === 'string' ? req.query.token : undefined;
    return bearer === expected || query === expected;
  }
}
